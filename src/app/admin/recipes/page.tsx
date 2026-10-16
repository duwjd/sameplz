import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCell,
  adminTable,
} from "@/components/admin/AdminShell";
import { adminSelect } from "@/components/admin/fields";
import { RecipeStatusForm } from "@/components/admin/RecipeStatusForm";
import { findRecipes } from "@/data/admin";
import { RECIPE_STATUS_LABEL } from "@/lib/admin/copy";
import { requireAdmin } from "@/lib/auth/admin";
import { kstDateTime } from "@/lib/play/copy";
import { STOP_REASON_COPY, type StopReason } from "@/lib/recipe/detail";

async function Recipes({
  searchParams,
}: {
  searchParams: PageProps<"/admin/recipes">["searchParams"];
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 40) : "";
  const rows = q ? await findRecipes(admin, q) : [];
  return (
    <AdminShell
      active="recipes"
      title="레시피 조치"
      description="판매 중지는 받은 사람이 계속 써요. 게시중단(불법·권리 침해)은 받은 사람에게도 숨겨요. 복원하면 게시중단 직전 상태로 돌아가요."
    >
      <form
        role="search"
        action="/admin/recipes"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <label htmlFor="adm-q" className="sr-only">
          공개 ID 또는 제목
        </label>
        <input
          id="adm-q"
          name="q"
          defaultValue={q}
          placeholder="공개 ID 또는 제목"
          maxLength={40}
          style={{ ...adminSelect, minWidth: 240 }}
        />
        <button
          type="submit"
          style={{ ...adminSelect, cursor: "pointer", fontWeight: 600 }}
        >
          찾기
        </button>
      </form>
      {q && rows.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          「{q}」에 맞는 레시피가 없어요.
        </p>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={adminTable}>
            <thead>
              <tr>
                {["레시피", "크리에이터", "상태", "조치"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    style={{ ...adminCell, fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={adminCell}>
                    {r.title}
                    <br />
                    <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
                      {r.publicId}
                    </span>
                  </td>
                  <td style={adminCell}>{r.creator}</td>
                  <td style={adminCell}>
                    {RECIPE_STATUS_LABEL[r.status] ?? r.status}
                    {r.stoppedReason && (
                      <>
                        <br />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--sp-fg-secondary)",
                          }}
                        >
                          {STOP_REASON_COPY[r.stoppedReason as StopReason] ??
                            r.stoppedReason}
                          {r.stoppedAt ? ` · ${kstDateTime(r.stoppedAt)}` : ""}
                        </span>
                      </>
                    )}
                  </td>
                  <td style={adminCell}>
                    <RecipeStatusForm
                      recipeId={r.id}
                      title={r.title}
                      status={r.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminRecipesPage(props: PageProps<"/admin/recipes">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Recipes searchParams={props.searchParams} />
    </Suspense>
  );
}
