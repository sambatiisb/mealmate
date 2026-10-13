import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrimaryQuad } from "@/lib/quad";
import { SignOutButton } from "@/components/sign-out-button";
import { LeaveQuadButton } from "@/components/leave-quad-button";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, quad] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    getUserPrimaryQuad(session.user.id),
  ]);
  if (!quad) redirect("/home-choice");

  const [preference, members, preferences] = await Promise.all([
    prisma.preference.findUnique({
      where: { userId_quadId: { userId: user.id, quadId: quad.id } },
      include: { dishes: { include: { dish: true } } },
    }),
    prisma.quadMember.findMany({ where: { quadId: quad.id, status: "accepted" }, include: { user: true } }),
    prisma.preference.findMany({ where: { quadId: quad.id, completedAt: { not: null } }, select: { userId: true } }),
  ]);
  const respondedUserIds = new Set(preferences.map((p) => p.userId));

  const isCreator = quad.createdBy === user.id;

  return (
    <>
      <h2 style={{ margin: 0 }}>Profile</h2>

      <div className="grid-2">
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--color-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {user.firstName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{user.firstName} {user.lastName}</div>
            <div className="text-muted" style={{ fontSize: 13 }}>@{user.username}</div>
            <div className="text-muted" style={{ fontSize: 13 }}>{user.mobileNumber}</div>
          </div>
        </div>

        <div className="card-dark" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-accent)" }}>{quad.name}</div>
          <div style={{ fontSize: 12.5, color: "#c9c9c4" }}>Invite code: {quad.inviteCode}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {members.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#e8e8e6" }}>{m.userId === user.id ? "You" : `${m.user.firstName} ${m.user.lastName}`}</span>
                <span style={{ color: respondedUserIds.has(m.userId) ? "var(--color-accent)" : "#8a8a85" }}>
                  {respondedUserIds.has(m.userId) ? "Ready" : "Pending"}
                </span>
              </div>
            ))}
          </div>
          <div className="text-muted" style={{ fontSize: 12, color: "#8a8a85", marginTop: 4 }}>
            Cutoffs — Lunch {quad.lunchCutoff}, Dinner {quad.dinnerCutoff}
          </div>
          <Link href={`/quad/${quad.id}/settings`} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-purple-light)", marginTop: 4 }}>
            {isCreator ? "Edit quad settings" : "View quad settings"}
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Your preferences</div>
        {preference ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Food type
              </div>
              <span className="tag">{user.vegOnly ? "Vegetarian only" : "Veg + non-veg"}</span>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Dish picks
              </div>
              <span className="text-muted" style={{ fontSize: 12.5 }}>
                {preference.dishes.length} {preference.dishes.length === 1 ? "dish" : "dishes"} selected
              </span>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Dietary flags
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {preference.dietaryFlags.length > 0 ? (
                  preference.dietaryFlags.map((f) => (
                    <span key={f} className="tag">{f}</span>
                  ))
                ) : (
                  <span className="text-muted" style={{ fontSize: 12.5 }}>None set</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="card-body" style={{ margin: 0 }}>You haven&apos;t set your preferences yet.</p>
        )}
        <Link href={`/preferences/cuisine?quadId=${quad.id}`} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Update your preferences
        </Link>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <LeaveQuadButton quadId={quad.id} quadName={quad.name} />
        <SignOutButton />
      </div>
    </>
  );
}
