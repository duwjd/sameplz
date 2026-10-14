"use client";
// Login state for client chrome + the m:login popup + "continue what you were doing" (F7-1) +
// the unfinished-signup guard (F7-9). The viewer is fetched on the client and URL-dependent effects
// live in a Suspense-wrapped child, so pages keep their static shell.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchViewer } from "@/actions/auth";
import { toggleFollow } from "@/actions/follow";
import { claimFreeRecipe } from "@/actions/recipe";
import { Toast } from "@/components/ds";
import {
  clearIntent,
  readIntent,
  saveIntent,
  type LoginIntent,
} from "@/lib/auth/intent";
import { readShareRef } from "@/lib/share-ref";
import { createClient } from "@/lib/supabase/client";
import { LoginDialog, type LoginProvider } from "./LoginDialog";

export type ClientViewer = Awaited<ReturnType<typeof fetchViewer>>;

interface AuthContextValue {
  viewer: ClientViewer;
  ready: boolean;
  /** Open the login popup; `intent` runs after login (F7-1). */
  requireLogin: (intent?: Partial<LoginIntent>) => void;
  /** Bumps when a replayed action (follow, claim) changed server state. */
  replayVersion: number;
  notify: (message: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export const LOGIN_SERVER_ERROR =
  "오류: 로그인 서버가 응답하지 않았어요. 잠시 뒤 다시 눌러 주세요.";

/** Current path + query without auth_error, read from the browser (no router hooks needed). */
function currentPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete("auth_error");
  return url.pathname + url.search;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<ClientViewer>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [replayVersion, setReplayVersion] = useState(0);
  const replayed = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshViewer = useCallback(async (): Promise<ClientViewer> => {
    try {
      const v = await fetchViewer();
      setViewer(v);
      return v;
    } catch {
      setViewer(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  // Viewer: on load and whenever Supabase auth state changes in this tab.
  useEffect(() => {
    let alive = true;
    fetchViewer()
      .catch(() => null)
      .then((v) => {
        if (!alive) return;
        setViewer(v);
        setReady(true);
      });
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refreshViewer();
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [refreshViewer]);

  // F7-1: replay the saved intent once after a completed login.
  useEffect(() => {
    if (!viewer?.signupComplete || replayed.current) return;
    const intent = readIntent();
    if (!intent) return;
    replayed.current = true;
    clearIntent();
    (async () => {
      const hello = `${viewer.nickname}님, 반가워요. 하던 걸 이어서 할게요.`;
      const action = intent.action;
      if (action?.type === "follow") {
        const res = await toggleFollow({ handle: action.handle, follow: true });
        if (res.ok) setReplayVersion((n) => n + 1);
        notify(hello);
      } else if (action?.type === "claim") {
        const res = await claimFreeRecipe({
          recipeId: action.recipeId,
          publicId: action.publicId,
          ref: readShareRef(action.publicId),
        });
        if (res.ok) setReplayVersion((n) => n + 1);
        notify(
          res.ok
            ? `${hello} 라이브러리에 담았어요.`
            : res.reason === "OWN_RECIPE"
              ? `${hello} 내 레시피라 받지 않아도 돼요.`
              : `${hello} 지금은 받을 수 없는 레시피예요.`,
        );
      } else {
        notify(hello);
      }
    })();
  }, [viewer, notify]);

  const requireLogin = useCallback((intent?: Partial<LoginIntent>) => {
    saveIntent({ next: intent?.next ?? currentPath(), action: intent?.action });
    setError(null);
    setBusy(false);
    setOpen(true);
  }, []);

  const showLoginError = useCallback(() => {
    setError(LOGIN_SERVER_ERROR);
    setBusy(false);
    setOpen(true);
  }, []);

  const onSelect = useCallback(async (provider: LoginProvider) => {
    const intent = readIntent() ?? { next: currentPath() };
    if (!readIntent()) saveIntent(intent);
    const next = encodeURIComponent(intent.next);
    setBusy(true);
    setError(null);
    if (provider === "google") {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
      if (oauthError) {
        setError(LOGIN_SERVER_ERROR);
        setBusy(false);
      }
      return;
    }
    // Route handler that 302s to Kakao/Naver: needs a full navigation, not a client transition.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/auth/${provider}?next=${next}`);
  }, []);

  const onClose = useCallback(() => {
    clearIntent(); // closing cancels what the user was about to do
    setOpen(false);
    setError(null);
    setBusy(false);
  }, []);

  const value = useMemo(
    () => ({ viewer, ready, requireLogin, replayVersion, notify }),
    [viewer, ready, requireLogin, replayVersion, notify],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <AuthRouteEffects
          viewer={viewer}
          onLoginError={showLoginError}
          refreshViewer={refreshViewer}
        />
      </Suspense>
      <LoginDialog
        open={open}
        error={error}
        busy={busy}
        onSelect={onSelect}
        onClose={onClose}
      />
      {/* Always mounted so screen readers announce each new toast. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          zIndex: 120,
        }}
      >
        {toast && <Toast title={toast} />}
      </div>
    </AuthContext.Provider>
  );
}

const SIGNUP_FREE_PATHS = ["/welcome", "/terms", "/privacy"];

/** URL-driven effects: login error round-trip and the unfinished-signup guard. Renders nothing. */
function AuthRouteEffects({
  viewer,
  onLoginError,
  refreshViewer,
}: {
  viewer: ClientViewer;
  onLoginError: () => void;
  refreshViewer: () => Promise<ClientViewer>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Back from a failed / cancelled login: reopen with the error (intent kept) or cancel silently.
  useEffect(() => {
    const code = searchParams.get("auth_error");
    if (!code) return;
    if (code === "access_denied") clearIntent();
    else onLoginError();
    router.replace(currentPath(), { scroll: false });
  }, [searchParams, router, onLoginError]);

  // F7-9: signed in but signup unfinished → /welcome first.
  // The cached viewer can be stale right after /welcome finishes, so confirm before redirecting.
  // Keyed on primitives: refreshViewer() sets a new viewer object, and depending on the object
  // re-ran this effect, cancelled the pending redirect and refetched forever.
  const needsSignup = Boolean(viewer && !viewer.signupComplete);
  useEffect(() => {
    if (!needsSignup || SIGNUP_FREE_PATHS.some((p) => pathname.startsWith(p)))
      return;
    let alive = true;
    refreshViewer().then((fresh) => {
      if (alive && fresh && !fresh.signupComplete) {
        router.replace(`/welcome?next=${encodeURIComponent(currentPath())}`);
      }
    });
    return () => {
      alive = false;
    };
  }, [needsSignup, pathname, router, refreshViewer]);

  return null;
}
