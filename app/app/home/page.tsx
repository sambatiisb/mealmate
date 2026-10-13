import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrimaryQuad } from "@/lib/quad";
import { currentWeekStart } from "@/lib/menu-generation";
import { currentWeekday, homeMealSlot } from "@/lib/cutoffs";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
import { SkipButton } from "@/components/skip-button";
import { NudgeButton } from "@/components/nudge-button";

interface MealLike {
  dish: { name: string };
  companionDish: { name: string } | null;
  priority1Dish: { name: string } | null;
}
function mealLabel(item: MealLike): string {
  const primary = (item.priority1Dish ?? item.dish).name;
  return item.companionDish ? `${primary} + ${item.companionDish.name}` : primary;
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quad = await getUserPrimaryQuad(session.user.id);
  if (!quad) redirect("/home-choice");

  const [members, preferences] = await Promise.all([
    prisma.quadMember.findMany({ where: { quadId: quad.id, status: "accepted" } }),
    prisma.preference.findMany({ where: { quadId: quad.id, completedAt: { not: null } } }),
  ]);
  const respondedUserIds = new Set(preferences.map((p) => p.userId));
  const totalMembers = members.length;
  const responded = members.filter((m) => respondedUserIds.has(m.userId)).length;

  const weekStart = currentWeekStart();

  // Cold-start: count how many weeks this quad has generated menus for
  const menuCount = await prisma.weeklyMenu.count({ where: { quadId: quad.id } });
  const isColdStart = menuCount <= 2;

  const menu = await prisma.weeklyMenu.findUnique({
    where: { quadId_weekStart: { quadId: quad.id, weekStart } },
    include: { items: { include: { dish: true, companionDish: true, priority1Dish: true, skips: true } } },
  });

  const today = currentWeekday();
  const lunchSlot = homeMealSlot("lunch", quad);
  const dinnerSlot = homeMealSlot("dinner", quad);
  const lunchItem = menu?.items.find((i) => i.day === lunchSlot.day && i.meal === "lunch");
  const dinnerItem = menu?.items.find((i) => i.day === dinnerSlot.day && i.meal === "dinner");
  const lunchDayLabel = lunchSlot.day === today ? "" : ` (${DAY_NAMES[lunchSlot.day]})`;
  const dinnerDayLabel = dinnerSlot.day === today ? "" : ` (${DAY_NAMES[dinnerSlot.day]})`;

  return (
    <>
      <div>
        <h2 style={{ margin: 0 }}>{quad.name}</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          {responded}/{totalMembers} quad-mates have set preferences
        </p>
      </div>

      {!menu && (
        <div className="card">
          <span className="card-title">Menu not ready yet</span>
          <p className="card-body" style={{ margin: 0 }}>
            Your weekly menu shows up here as soon as anyone in the quad sets
            their preferences.
          </p>
        </div>
      )}

      {menu && responded < totalMembers && (
        <div className="note-purple">{responded}/{totalMembers} preferences considered so far.</div>
      )}

      {isColdStart && menu && (
        <div className="note-purple">
          Fresh menu — variety improves from week 3 as your history builds up.
        </div>
      )}

      {menu?.relaxedConsensus && !isColdStart && (
        <div className="note-purple">
          A few of this week&apos;s dishes may not be everyone&apos;s first pick — we
          didn&apos;t have enough dishes everyone agreed on.
        </div>
      )}

      {menu && (
        <div className="grid-2">
          <div className="card-dark" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Lunch{lunchDayLabel}{lunchItem ? ` · ${mealLabel(lunchItem)}` : ""}
              </span>
              <span style={{ fontSize: 11, color: "#8a8a85" }}>Cutoff {quad.lunchCutoff}</span>
            </div>
            {lunchItem ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, color: "#c9c9c4" }}>Skip this lunch</span>
                {!lunchSlot.isOpen ? (
                  <span style={{ fontSize: 12, color: "#8a8a85" }}>Closed</span>
                ) : (
                  <SkipButton
                    menuItemId={lunchItem.id}
                    initiallySkipped={lunchItem.skips.some((s) => s.userId === session.user.id)}
                  />
                )}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "#8a8a85" }}>Nothing planned</span>
            )}
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-purple)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Dinner{dinnerDayLabel}{dinnerItem ? ` · ${mealLabel(dinnerItem)}` : ""}
              </span>
              <span className="text-muted" style={{ fontSize: 11 }}>Cutoff {quad.dinnerCutoff}</span>
            </div>
            {dinnerItem ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="text-muted" style={{ fontSize: 14 }}>Skip this dinner</span>
                {!dinnerSlot.isOpen ? (
                  <span className="text-muted" style={{ fontSize: 12 }}>Closed</span>
                ) : (
                  <SkipButton
                    menuItemId={dinnerItem.id}
                    initiallySkipped={dinnerItem.skips.some((s) => s.userId === session.user.id)}
                  />
                )}
              </div>
            ) : (
              <span className="text-muted" style={{ fontSize: 13 }}>Nothing planned</span>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Quorum status</div>
            <p className="card-body" style={{ margin: 0 }}>
              {responded} of {totalMembers} quad-mates have set preferences
            </p>
          </div>
          <NudgeButton quadId={quad.id} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 4,
                background: respondedUserIds.has(m.userId) ? "var(--color-accent)" : "var(--border-input)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
