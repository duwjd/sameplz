import "server-only";
import { notFound } from "next/navigation";
import { getViewer, type Viewer } from "@/lib/auth/account";

// ADM (MVP): the admin is profiles.role = 'admin', read from the verified session on the server.
// The JWT `admin` claim hook and MFA come with F8-4.

export async function getAdmin(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.signupComplete && viewer.role === "admin" ? viewer : null;
}

/** /admin pages: anyone else gets the same 404 as a missing page. */
export async function requireAdmin(): Promise<Viewer> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
