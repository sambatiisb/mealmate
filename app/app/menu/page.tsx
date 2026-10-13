import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrimaryQuad } from "@/lib/quad";
import { currentWeekStart } from "@/lib/menu-generation";
import { MenuWeekView } from "@/components/menu-week-view";

export default async function MenuPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quad = await getUserPrimaryQuad(session.user.id);
  if (!quad) redirect("/home-choice");

  const weekStart = currentWeekStart();
  const [menu, totalMembers, responded] = await Promise.all([
    prisma.weeklyMenu.findUnique({
      where: { quadId_weekStart: { quadId: quad.id, weekStart } },
      include: {
        items: {
          include: { dish: true, companionDish: true, priority1Dish: true, priority2Dish: true },
          orderBy: [{ day: "asc" }, { meal: "asc" }],
        },
        approvals: true,
      },
    }),
    prisma.quadMember.count({ where: { quadId: quad.id, status: "accepted" } }),
    prisma.preference.count({ where: { quadId: quad.id, completedAt: { not: null } } }),
  ]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>This week&apos;s menu</h2>
          <p className="text-muted" style={{ margin: 0 }}>Tap a meal to propose a swap or view details</p>
        </div>
        {menu && (
          <span
            style={{
              background: "var(--color-dark)",
              color: "var(--color-accent)",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 10,
            }}
          >
            {menu.status === "locked" ? "Locked · editable before cutoff" : "Awaiting approval"}
          </span>
        )}
      </div>

      {!menu && (
        <p className="text-muted">
          No menu yet — it&apos;ll appear as soon as anyone in the quad has set
          their preferences.
        </p>
      )}

      {menu && responded < totalMembers && (
        <div className="note-purple">{responded}/{totalMembers} preferences considered so far — the menu updates as more quad-mates respond.</div>
      )}

      {menu?.relaxedConsensus && (
        <div className="note-purple">
          A few of this week&apos;s dishes may not be everyone&apos;s first pick — we
          didn&apos;t have enough dishes everyone agreed on.
        </div>
      )}

      {menu && (
        <MenuWeekView
          quadId={quad.id}
          quadName={quad.name}
          menuId={menu.id}
          status={menu.status}
          items={menu.items}
          needsMyApproval={!menu.approvals.some((a) => a.userId === session.user.id)}
        />
      )}
    </>
  );
}
