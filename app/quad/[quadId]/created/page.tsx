import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteActions } from "./invite-actions";

export default async function QuadCreatedPage({
  params,
}: {
  params: Promise<{ quadId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await params;
  const quad = await prisma.quad.findUnique({ where: { id: quadId } });
  if (!quad || quad.createdBy !== session.user.id) notFound();

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ alignItems: "center", textAlign: "center" }}>
        <div>
          <h2>{quad.name}</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Share this code with your quad-mates so they can join.
          </p>
        </div>

        <div
          style={{
            background: "var(--color-bg)",
            borderRadius: 16,
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            width: "100%",
          }}
        >
          <span className="card-kicker">Invite code</span>
          <span style={{ fontWeight: 800, fontSize: 36, letterSpacing: "1px" }}>{quad.inviteCode}</span>
        </div>

        <InviteActions inviteCode={quad.inviteCode} />

        {quad.invitedMobileNumbers.length > 0 && (
          <div style={{ width: "100%", textAlign: "left" }}>
            <h6>Waiting on</h6>
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: 14 }}>
              {quad.invitedMobileNumbers.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <a href={`/preferences/dishes?quadId=${quad.id}`} className="btn btn-primary btn-block">
          Set my preferences
        </a>
      </div>
    </div>
  );
}
