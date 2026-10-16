// ADM members (F8-4): find a member by id, handle or nickname.
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCell,
  adminTable,
} from "@/components/admin/AdminShell";
import { adminSelect } from "@/components/admin/fields";
import { findUsers } from "@/data/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { kstDateTime } from "@/lib/play/copy";

async function Users({
  searchParams,
}: {
  searchParams: PageProps<"/admin/users">["searchParams"];
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 40) : "";
  const rows = q ? await findUsers(admin, q) : [];
  return (
    <AdminShell
      active="users"
      title="회원"
      description="제재(경고·판매 정지·계정 정지·차단), 멈춘 생성 다시 열기, 크레딧 조정을 해요. 모든 조치는 사유와 함께 운영 기록에 남고 회원에게 알림이 가요."
    >
      <form role="search" action="/admin/users" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="adm-uq" className="sr-only">
          회원 id, 핸들 또는 닉네임
        </label>
        <input
          id="adm-uq"
          name="q"
          defaultValue={q}
          placeholder="회원 id, 핸들 또는 닉네임"
          maxLength={40}
          style={{ ...adminSelect, minWidth: 260 }}
        />
        <button type="submit" style={{ ...adminSelect, cursor: "pointer", fontWeight: 600 }}>
          찾기
        </button>
      </form>
      {q && rows.length === 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          「{q}」에 맞는 회원이 없어요.
        </p>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={adminTable}>
            <thead>
              <tr>
                {["회원", "가입", "상태"].map((h) => (
                  <th key={h} scope="col" style={{ ...adminCell, fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={adminCell}>
                    <Link href={`/admin/users/${u.id}`}>{u.nickname}</Link>
                    <br />
                    <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>@{u.handle}</span>
                  </td>
                  <td style={adminCell}>{kstDateTime(u.createdAt)}</td>
                  <td style={adminCell}>{u.withdrawn ? "탈퇴" : "이용 중"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminUsersPage(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Users searchParams={props.searchParams} />
    </Suspense>
  );
}
