import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CutoffsForm } from "./cutoffs-form";
import { NonVegDaysForm } from "./nonveg-days-form";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function QuadSettingsPage({
  params,
}: {
  params: Promise<{ quadId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await params;
  const quad = await prisma.quad.findUnique({ where: { id: quadId } });
  if (!quad) notFound();

  const members = await prisma.quadMember.findMany({
    where: { quadId, status: "accepted" },
    include: { user: { select: { vegOnly: true } } },
  });
  const isMember = members.some((m) => m.userId === session.user.id);
  if (!isMember) notFound();

  const isCreator = quad.createdBy === session.user.id;
  // Mixed quad = at least one veg-only member and at least one member who
  // eats non-veg — that's when "which days can we cook non-veg?" matters.
  const isMixed = members.some((m) => m.user.vegOnly) && members.some((m) => !m.user.vegOnly);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 640 }}>
        <div>
          <h6>Quad settings</h6>
          <h2>{quad.name}</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Invite code: <strong style={{ color: "var(--color-text)" }}>{quad.inviteCode}</strong>
          </p>
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Skip &amp; edit cutoffs</div>
          {isCreator ? (
            <CutoffsForm quadId={quadId} lunchCutoff={quad.lunchCutoff} dinnerCutoff={quad.dinnerCutoff} />
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>
              Lunch {quad.lunchCutoff} · Dinner {quad.dinnerCutoff} — only the
              quad creator can change this.
            </p>
          )}
        </div>

        {isMixed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Non-veg days</div>
            <p className="text-muted" style={{ margin: "0 0 10px" }}>
              Your quad has both veg-only and non-veg-eating members. Pick
              which days can include non-veg — a veg dish is always cooked
              alongside it too, so everyone has something to eat.
            </p>
            {isCreator ? (
              <NonVegDaysForm quadId={quadId} dayLabels={DAY_LABELS} existing={quad.nonVegDays} />
            ) : (
              <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                {quad.nonVegDays.length > 0
                  ? quad.nonVegDays.map((d) => DAY_LABELS[d]).join(", ")
                  : "No non-veg days set yet"}{" "}
                — only the quad creator can change this.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
