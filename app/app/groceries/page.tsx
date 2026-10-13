import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrimaryQuad } from "@/lib/quad";
import { currentWeekStart, autoLockIfDeadlinePassed } from "@/lib/menu-generation";
import { GroceryShareButton } from "@/components/grocery-share-button";

const INGREDIENT_INCLUDE = {
  dishIngredients: {
    include: { ingredient: true },
    where: { isOptional: false },
  },
} as const;

export default async function GroceriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quad = await getUserPrimaryQuad(session.user.id);
  if (!quad) redirect("/home-choice");

  const weekStart = currentWeekStart();
  const [menu, totalMembers] = await Promise.all([
    prisma.weeklyMenu.findUnique({
      where: { quadId_weekStart: { quadId: quad.id, weekStart } },
      include: {
        items: {
          include: {
            dish: { include: INGREDIENT_INCLUDE },
            companionDish: { include: INGREDIENT_INCLUDE },
            priority1Dish: { include: INGREDIENT_INCLUDE },
          },
        },
        approvals: true,
      },
    }),
    prisma.quadMember.count({ where: { quadId: quad.id, status: "accepted" } }),
  ]);

  if (!menu) {
    return (
      <>
        <h2 style={{ margin: 0 }}>Groceries</h2>
        <p className="text-muted">No grocery list yet — it&apos;s generated once your weekly menu is ready.</p>
      </>
    );
  }

  const deadlinePassed = Boolean(menu.approvalDeadline) && Date.now() >= menu.approvalDeadline!.getTime();
  if (deadlinePassed) {
    // Ensures status flips to "locked" even if nobody explicitly voted in time.
    await autoLockIfDeadlinePassed(menu);
  }
  const approvedCount = menu.approvals.filter((a) => a.approved).length;
  // Once the window closes the menu is locked (explicitly or via the auto-lock
  // above) — groceries are gated purely on the window, not a separate status check.
  const canShowGroceries = deadlinePassed;

  if (!canShowGroceries) {
    return (
      <>
        <h2 style={{ margin: 0 }}>Groceries</h2>
        <div className="card">
          {menu.status !== "locked" ? (
            <>
              <span className="card-title">All members have not approved the menu</span>
              <p className="card-body" style={{ margin: 0 }}>
                Please approve the menu to see the final grocery list.{" "}
                {approvedCount}/{totalMembers} have approved.
              </p>
            </>
          ) : (
            <>
              <span className="card-title">Groceries unlock after the review window</span>
              <p className="card-body" style={{ margin: 0 }}>
                The menu&apos;s approved — the grocery list appears once the
                24-hour edit window closes, so late changes aren&apos;t missed.
              </p>
            </>
          )}
        </div>
      </>
    );
  }

  // Aggregate ingredients across the *active* dish for each meal (priority1
  // if edited, else the original) plus its companion dish, if any. priority2
  // (the edit fallback) is intentionally excluded — it's only cooked if the
  // active pick's ingredients turn out unavailable, not planned for upfront.
  type AggEntry = {
    name: string;
    category: string | null;
    totalQty: number | null;
    unit: string | null;
    hasQty: boolean;
  };
  const aggregated = new Map<string, AggEntry>();

  function addDishIngredients(
    dishIngredients: { ingredient: { id: string; name: string; category: string | null }; quantity: number | null; unit: string | null }[]
  ) {
    for (const di of dishIngredients) {
      const existing = aggregated.get(di.ingredient.id);
      if (existing) {
        if (di.quantity != null && existing.hasQty) {
          existing.totalQty = (existing.totalQty ?? 0) + di.quantity;
        } else {
          existing.hasQty = false;
          existing.totalQty = null;
        }
      } else {
        aggregated.set(di.ingredient.id, {
          name: di.ingredient.name,
          category: di.ingredient.category,
          totalQty: di.quantity,
          unit: di.unit,
          hasQty: di.quantity != null,
        });
      }
    }
  }

  for (const item of menu.items) {
    const activeDish = item.priority1Dish ?? item.dish;
    addDishIngredients(activeDish.dishIngredients);
    if (item.companionDish) {
      addDishIngredients(item.companionDish.dishIngredients);
    }
  }

  // If catalog ingredients aren't seeded yet, fall back to showing dishes
  const hasIngredients = aggregated.size > 0;

  // Group by category
  const byCategory = new Map<string, AggEntry[]>();
  for (const entry of aggregated.values()) {
    const cat = entry.category ?? "Other";
    const list = byCategory.get(cat) ?? [];
    list.push(entry);
    byCategory.set(cat, list);
  }
  const sortedCategories = [...byCategory.keys()].sort();

  const shareText = sortedCategories
    .map((cat) => {
      const items = byCategory.get(cat)!.sort((a, b) => a.name.localeCompare(b.name));
      const lines = items.map((item) =>
        item.hasQty && item.totalQty != null
          ? `- ${item.name} — ${Math.round(item.totalQty)}${item.unit ? ` ${item.unit}` : ""}`
          : `- ${item.name}`
      );
      return `*${cat}*\n${lines.join("\n")}`;
    })
    .join("\n\n");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Groceries</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            {hasIngredients
              ? "Aggregated ingredients for this week's menu"
              : "Dishes planned this week — ingredient detail available after catalog sync"}
          </p>
        </div>
        {hasIngredients && (
          <GroceryShareButton quadName={quad.name} text={`*Groceries — ${quad.name}*\n\n${shareText}`} />
        )}
      </div>

      {hasIngredients ? (
        <div className="grid-cards">
          {sortedCategories.map((cat) => {
            const items = byCategory.get(cat)!.sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={cat} className="card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{cat}</div>
                <table className="table">
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.name}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: "right", color: "var(--color-muted)", fontSize: 13 }}>
                          {item.hasQty && item.totalQty != null
                            ? `${Math.round(item.totalQty)}${item.unit ? ` ${item.unit}` : ""}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback: dish listing grouped by cuisine
        <div className="grid-cards">
          {(() => {
            const byCuisine = new Map<string, Set<string>>();
            for (const item of menu.items) {
              const dish = item.priority1Dish ?? item.dish;
              const names = byCuisine.get(dish.cuisine) ?? new Set<string>();
              names.add(dish.name);
              if (item.companionDish) names.add(item.companionDish.name);
              byCuisine.set(dish.cuisine, names);
            }
            return [...byCuisine.entries()].map(([cuisine, names]) => (
              <div key={cuisine} className="card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{cuisine}</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {[...names].map((n) => <li key={n} style={{ fontSize: 14 }}>{n}</li>)}
                </ul>
              </div>
            ));
          })()}
        </div>
      )}
    </>
  );
}
