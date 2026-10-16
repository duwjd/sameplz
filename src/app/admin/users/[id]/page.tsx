// ADM member detail (F8-4): sanctions, credits, linked accounts and the actions on them.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCard,
  adminCell,
  adminTable,
} from "@/components/admin/AdminShell";
import {
  AdjustCreditsForm,
  LiftSanctionButton,
  ResumeGenerationButton,
  SanctionForm,
} from "@/components/admin/UserActions";
import { getUserDetail } from "@/data/admin";
import { SANCTION_LEVEL_LABEL, SANCTION_REASON_LABEL } from "@/lib/admin/copy";
import { requireAdmin } from "@/lib/auth/admin";
import { kstDateTime } from "@/lib/play/copy";

const LEDGER_LABEL: Record<string, string> = {
  grant: "지급",
  hold: "실행 예약",
  capture: "사용 확정",
  release: "돌려줌",
  expire: "소멸",
  adjust: "운영 조정",
};

const h2 = { margin: 0, fontSize: 18, fontWeight: 800 } as const;
const muted = { margin: 0, fontSize: 13, color: "var(--sp-fg-secondary)" } as const;

async function UserDetail({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await getUserDetail(admin, id);
  if (!d) notFound();
  const { user, credits } = d;
  const active = d.sanctions.filter((s) => s.active);
  const editable = !user.withdrawn && user.role !== "admin";
  return (
    <AdminShell
      active="users"
      title={user.nickname}
      description={`@${user.handle} · 가입 ${kstDateTime(user.createdAt)}${user.withdrawn ? " · 탈퇴" : ""}`}
    >
      <section style={adminCard} aria-labelledby="u-sanction">
        <h2 id="u-sanction" style={h2}>
          제재
        </h2>
        <p style={muted}>
          {active.length
            ? `지금 적용 중: ${active.map((s) => SANCTION_LEVEL_LABEL[s.level] ?? s.level).join(", ")}`
            : "지금 적용 중인 제재가 없어요."}
        </p>
        {editable && (
          <div>
            <SanctionForm userId={user.id} nickname={user.nickname} />
          </div>
        )}
        {d.sanctions.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={adminTable}>
              <thead>
                <tr>
                  {["단계", "사유", "기간", "상태", ""].map((h, i) => (
                    <th key={i} scope="col" style={{ ...adminCell, fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.sanctions.map((s) => (
                  <tr key={s.id}>
                    <td style={adminCell}>{SANCTION_LEVEL_LABEL[s.level] ?? s.level}</td>
                    <td style={adminCell}>
                      {SANCTION_REASON_LABEL[s.reason] ?? s.reason}
                      {s.note && (
                        <>
                          <br />
                          <span style={{ fontSize: 12, color: "var(--sp-fg-secondary)" }}>{s.note}</span>
                        </>
                      )}
                    </td>
                    <td style={adminCell}>
                      {kstDateTime(s.startsAt)} ~ {s.endsAt ? kstDateTime(s.endsAt) : "해제할 때까지"}
                    </td>
                    <td style={adminCell}>
                      {s.liftedAt ? `해제 ${kstDateTime(s.liftedAt)}` : s.active ? "적용 중" : "끝남"}
                      {s.liftNote && (
                        <>
                          <br />
                          <span style={{ fontSize: 12, color: "var(--sp-fg-secondary)" }}>{s.liftNote}</span>
                        </>
                      )}
                    </td>
                    <td style={adminCell}>
                      {s.active && (
                        <LiftSanctionButton
                          sanctionId={s.id}
                          label={SANCTION_LEVEL_LABEL[s.level] ?? s.level}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={adminCard} aria-labelledby="u-credits">
        <h2 id="u-credits" style={h2}>
          크레딧
        </h2>
        {credits ? (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              쓸 수 있어요 {credits.available}C · 실행 중 {credits.held}C
              {credits.grantEligible ? "" : " · 월 무료 지급 없음"}
            </p>
            {credits.generationSuspendedAt && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <p style={muted}>
                  안전 필터에 여러 번 걸려 {kstDateTime(credits.generationSuspendedAt)}부터 생성이 멈췄어요.
                </p>
                {editable && <ResumeGenerationButton userId={user.id} />}
              </div>
            )}
          </>
        ) : (
          <p style={muted}>아직 크레딧 계정이 없어요(가입 마무리 전).</p>
        )}
        {editable && (
          <div>
            <AdjustCreditsForm userId={user.id} nickname={user.nickname} />
          </div>
        )}
        {d.ledger.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={adminTable}>
              <caption style={{ ...muted, textAlign: "left", padding: "4px 0" }}>최근 원장 20줄</caption>
              <thead>
                <tr>
                  {["언제", "종류", "변화"].map((h) => (
                    <th key={h} scope="col" style={{ ...adminCell, fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.ledger.map((g, i) => (
                  <tr key={i}>
                    <td style={adminCell}>{kstDateTime(g.at)}</td>
                    <td style={adminCell}>{LEDGER_LABEL[g.type] ?? g.type}</td>
                    <td style={adminCell}>
                      {g.delta > 0 ? "+" : ""}
                      {g.delta}C
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={adminCard} aria-labelledby="u-linked">
        <h2 id="u-linked" style={h2}>
          연결 계정
        </h2>
        <p style={muted}>
          같은 기기나 같은 IP에서 쓴 계정이에요. 공용 와이파이·가족 기기일 수 있어서 확률적 판단이에요(D13). 이것만으로
          제재하지 말고 다른 근거와 함께 봐 주세요.
        </p>
        {d.linked.length === 0 ? (
          <p style={muted}>연결된 계정이 없어요.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            {d.linked.map((a) => (
              <li key={a.id}>
                <a href={`/admin/users/${a.id}`}>{a.nickname}</a> @{a.handle} ·{" "}
                {a.via.map((v) => (v === "device" ? "같은 기기" : "같은 IP")).join(", ")}
                {a.withdrawn ? " · 탈퇴" : ""}
                {a.sanction ? ` · ${SANCTION_LEVEL_LABEL[a.sanction] ?? a.sanction}` : ""}
              </li>
            ))}
          </ul>
        )}
        {d.signals.length > 0 && (
          <p style={muted}>
            최근 남용 신호: {d.signals.map((s) => `${s.kind}(${kstDateTime(s.at)})`).join(", ")}
          </p>
        )}
      </section>
    </AdminShell>
  );
}

export default function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <UserDetail params={props.params} />
    </Suspense>
  );
}
