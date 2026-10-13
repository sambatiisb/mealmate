import { prisma } from "@/lib/prisma";
import type { Meal } from "@/lib/generated/prisma/enums";

const DAYS_IN_WEEK = 7;
const MEALS: Meal[] = ["lunch", "dinner"];
const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Cuisine weight: Indian-origin = 1.0, Continental = 0.6 (per original spec)
const CUISINE_WEIGHTS: Record<string, number> = {
  "North Indian": 1.0,
  "South Indian": 1.0,
  Andhra: 1.0,
  Hyderabadi: 1.0,
  Indian: 1.0,
  "Indo-Chinese": 1.0,
  "Street Food": 1.0,
  Healthy: 1.0,
  Continental: 0.6,
};
function cuisineWeight(cuisine: string) {
  return CUISINE_WEIGHTS[cuisine] ?? 1.0;
}

/** Dish types that can never be the sole/main dish of a meal (pickle, chutney, etc.) — only eligible as a companion dish alongside a real main. */
const SIDE_DISH_TYPES = new Set(["Side"]);

/** Monday 00:00 IST of the week containing `now`, expressed as a UTC Date for storage. */
export function currentWeekStart(now: Date = new Date()): Date {
  const istParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => istParts.find((p) => p.type === type)?.value ?? "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const weekdayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const dayIndex = weekdayMap[get("weekday")] ?? 0;
  const asUtcMidnight = new Date(`${dateStr}T00:00:00.000Z`);
  asUtcMidnight.setUTCDate(asUtcMidnight.getUTCDate() - dayIndex);
  return asUtcMidnight;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type MealTemplate =
  | "SINGLE_VEG"
  | "SINGLE_NONVEG"
  | "DOUBLE_VEG_VEG"
  | "DOUBLE_VEG_NONVEG"
  | "DOUBLE_NONVEG_NONVEG";

type QuadComposition = "ALL_VEG" | "MIXED" | "OPEN";

interface CandidateDish {
  id: string;
  cuisine: string;
  subcategory: string | null;
  dishType: string | null;
  isVeg: boolean;
  containsEgg: boolean;
  isProteinRich: boolean;
  proteinSourceType: string | null;
  score: number; // weighted member-pick count
  bucket: "A" | "B"; // A = fresh, B = cooling-down
  clusterKey: string; // cuisine+subcategory
}

// ─── Phase 1, Step 1: Build the safe pool ───────────────────────────────────

async function buildSafePool(quadId: string, weekStart: Date) {
  const preferences = await prisma.preference.findMany({
    where: { quadId, completedAt: { not: null } },
    include: {
      dishes: { include: { dish: true } },
      user: { select: { vegOnly: true } },
    },
  });

  // Union of all picked dishes, minus any that violate ANY member's dietary flags
  const allFlags = preferences.flatMap((p) => p.dietaryFlags);
  const bannedFlags = new Set(allFlags);

  // Score = sum of (member-pick count × cuisine weight)
  const scoreMap = new Map<string, { dish: CandidateDish; rawCount: number }>();
  for (const pref of preferences) {
    for (const pd of pref.dishes) {
      const d = pd.dish;
      // Dietary safety: skip if any dish flag matches any member's restriction
      if (d.containsFlags.some((f) => bannedFlags.has(f))) continue;
      const clusterKey = `${d.cuisine}::${d.subcategory ?? ""}`;
      const existing = scoreMap.get(d.id);
      if (existing) {
        existing.rawCount += 1;
        existing.dish.score += cuisineWeight(d.cuisine);
      } else {
        scoreMap.set(d.id, {
          rawCount: 1,
          dish: {
            id: d.id,
            cuisine: d.cuisine,
            subcategory: d.subcategory,
            dishType: d.dishType,
            isVeg: d.isVeg,
            containsEgg: d.containsEgg,
            isProteinRich: d.isProteinRich,
            proteinSourceType: d.proteinSourceType,
            score: cuisineWeight(d.cuisine),
            bucket: "A",
            clusterKey,
          },
        });
      }
    }
  }

  // Build recency buckets using last 2 weeks of history
  const twoWeeksAgo = new Date(weekStart);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
  const oneWeekAgo = new Date(weekStart);
  oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);

  const recentMenus = await prisma.weeklyMenu.findMany({
    where: { quadId, weekStart: { gte: twoWeeksAgo, lt: weekStart } },
    include: { items: { select: { dishId: true, companionDishId: true } } },
  });

  const servedLastWeek = new Set<string>();
  const servedTwoWeeksAgo = new Set<string>();

  for (const menu of recentMenus) {
    const isLastWeek = menu.weekStart >= oneWeekAgo;
    for (const item of menu.items) {
      const target = isLastWeek ? servedLastWeek : servedTwoWeeksAgo;
      target.add(item.dishId);
      if (item.companionDishId) target.add(item.companionDishId);
    }
  }

  // Assign buckets and remove dishes served last week
  const pool: CandidateDish[] = [];
  for (const { dish } of scoreMap.values()) {
    if (servedLastWeek.has(dish.id)) continue; // excluded
    dish.bucket = servedTwoWeeksAgo.has(dish.id) ? "B" : "A";
    pool.push(dish);
  }

  // Quad composition
  const hasVegOnlyMember = preferences.some((p) => p.user.vegOnly);
  const hasNonVegInPool = pool.some((d) => !d.isVeg);

  let composition: QuadComposition;
  if (!hasNonVegInPool) composition = "ALL_VEG";
  else if (hasVegOnlyMember) composition = "MIXED";
  else composition = "OPEN";

  return {
    pool,
    composition,
    relaxedConsensus: pool.some((d) => {
      const entry = scoreMap.get(d.id);
      return entry ? entry.rawCount < preferences.length : false;
    }),
  };
}

// ─── Phase 1, Step 2: Decide meal templates ──────────────────────────────────

function decideMealTemplates(
  cookingStyle: "simple" | "standard",
  composition: QuadComposition,
  nonVegDays: Set<number>
): MealTemplate[][] {
  // Returns [lunch template, dinner template] per day (14 decisions total)
  const week: MealTemplate[][] = [];

  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    let lunchTemplate: MealTemplate;
    let dinnerTemplate: MealTemplate;
    const isNonVegDay = nonVegDays.has(day);

    if (cookingStyle === "simple") {
      switch (composition) {
        case "ALL_VEG":
          lunchTemplate = "SINGLE_VEG";
          dinnerTemplate = "SINGLE_VEG";
          break;
        case "MIXED":
          // Non-veg day: veg dish always present alongside non-veg (§6 safety rule).
          // Non-nonveg day: veg only, no ask needed.
          lunchTemplate = isNonVegDay ? "DOUBLE_VEG_NONVEG" : "SINGLE_VEG";
          dinnerTemplate = "SINGLE_VEG";
          break;
        case "OPEN":
          lunchTemplate = isNonVegDay ? "SINGLE_NONVEG" : "SINGLE_VEG";
          dinnerTemplate = "SINGLE_VEG";
          break;
      }
    } else {
      // standard
      switch (composition) {
        case "ALL_VEG":
          lunchTemplate = "DOUBLE_VEG_VEG";
          dinnerTemplate = "DOUBLE_VEG_VEG";
          break;
        case "MIXED":
          // Never DOUBLE_NONVEG_NONVEG for a MIXED quad — a veg-only member must
          // always have something to eat.
          lunchTemplate = isNonVegDay ? "DOUBLE_VEG_NONVEG" : "DOUBLE_VEG_VEG";
          dinnerTemplate = "DOUBLE_VEG_VEG";
          break;
        case "OPEN":
          lunchTemplate = isNonVegDay ? "DOUBLE_NONVEG_NONVEG" : "DOUBLE_VEG_NONVEG";
          dinnerTemplate = "DOUBLE_VEG_VEG";
          break;
      }
    }

    week.push([lunchTemplate, dinnerTemplate]);
  }

  return week;
}

// ─── Phase 1, Steps 3-9: Fill meals ──────────────────────────────────────────

interface FilledItem {
  day: number;
  meal: Meal;
  dishId: string;
  companionDishId: string | null;
  template: MealTemplate;
}

function fillMenu(
  pool: CandidateDish[],
  weekTemplates: MealTemplate[][],
  composition: QuadComposition
): FilledItem[] {
  const items: FilledItem[] = [];

  // Track what's been used this week — cluster cap, bucket-B cap, and now a
  // hard "don't repeat a dish within the same week" cap (§ repeated-dishes bug).
  const clusterUsedThisWeek = new Set<string>();
  const usedDishIdsThisWeek = new Set<string>();
  const bucketBUsedCount = { count: 0 };

  const mainVegPool = pool.filter((d) => d.isVeg && !SIDE_DISH_TYPES.has(d.dishType ?? ""));
  const mainNonVegPool = pool.filter((d) => !d.isVeg && !SIDE_DISH_TYPES.has(d.dishType ?? ""));
  // Companions (second dish in a DOUBLE slot) may include sides — that's the
  // only place a side dish is allowed to appear.
  const companionVegPool = pool.filter((d) => d.isVeg);
  const companionNonVegPool = pool.filter((d) => !d.isVeg);

  function pickDish(
    subPool: CandidateDish[],
    dayUsedCuisines: string[],
    excludeIds: Set<string>
  ): CandidateDish | null {
    function candidatesWith(allowRepeat: boolean, relaxCluster: boolean) {
      return subPool
        .filter(
          (d) =>
            !excludeIds.has(d.id) &&
            (allowRepeat || !usedDishIdsThisWeek.has(d.id)) &&
            (relaxCluster || !clusterUsedThisWeek.has(d.clusterKey)) &&
            (d.bucket === "A" || bucketBUsedCount.count < 2)
        )
        .sort((a, b) => {
          if (a.bucket !== b.bucket) return a.bucket === "A" ? -1 : 1;
          const aAdj = dayUsedCuisines.includes(a.cuisine) ? 1 : 0;
          const bAdj = dayUsedCuisines.includes(b.cuisine) ? 1 : 0;
          if (aAdj !== bAdj) return aAdj - bAdj;
          return b.score - a.score;
        });
    }

    // Escalating relaxation: no-repeat+cluster-cap → no-repeat, relaxed cluster
    // → repeats allowed only as an absolute last resort (pool exhausted).
    return (
      candidatesWith(false, false)[0] ??
      candidatesWith(false, true)[0] ??
      candidatesWith(true, true)[0] ??
      null
    );
  }

  const cuisinesByDay: string[][] = Array.from({ length: DAYS_IN_WEEK }, () => []);

  function markUsed(dish: CandidateDish) {
    usedDishIdsThisWeek.add(dish.id);
    clusterUsedThisWeek.add(dish.clusterKey);
    if (dish.bucket === "B") bucketBUsedCount.count++;
  }

  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    const adjacentCuisines = [
      ...(day > 0 ? cuisinesByDay[day - 1] : []),
      ...(day < DAYS_IN_WEEK - 1 ? cuisinesByDay[day + 1] : []),
    ];

    for (let mi = 0; mi < MEALS.length; mi++) {
      const meal = MEALS[mi];
      let template = weekTemplates[day][mi];
      const usedThisMeal = new Set<string>();

      if (composition === "MIXED" && template === "SINGLE_NONVEG") {
        template = "DOUBLE_VEG_NONVEG"; // safety upgrade — never non-veg-only for a mixed quad
      }

      if (template === "SINGLE_VEG" || template === "SINGLE_NONVEG") {
        const subPool = template === "SINGLE_VEG" ? mainVegPool : mainNonVegPool;
        const fallback = template === "SINGLE_VEG" ? mainNonVegPool : mainVegPool;
        const dish = pickDish(subPool, adjacentCuisines, usedThisMeal) ?? pickDish(fallback, adjacentCuisines, usedThisMeal);
        if (dish) {
          usedThisMeal.add(dish.id);
          markUsed(dish);
          cuisinesByDay[day].push(dish.cuisine);
          items.push({ day, meal, dishId: dish.id, companionDishId: null, template });
        }
      } else {
        const [role1IsVeg, role2IsVeg] = (() => {
          switch (template) {
            case "DOUBLE_VEG_VEG":
              return [true, true];
            case "DOUBLE_VEG_NONVEG":
              return [true, false];
            case "DOUBLE_NONVEG_NONVEG":
              return [false, false];
            default:
              return [true, true];
          }
        })();

        const mainPool = role1IsVeg ? mainVegPool : mainNonVegPool;
        const dish1 = pickDish(mainPool, adjacentCuisines, usedThisMeal) ?? pickDish(pool, adjacentCuisines, usedThisMeal);

        let dish2: CandidateDish | null = null;
        if (dish1) {
          usedThisMeal.add(dish1.id);
          markUsed(dish1);
          cuisinesByDay[day].push(dish1.cuisine);

          const companionPool = role2IsVeg ? companionVegPool : companionNonVegPool;
          dish2 = pickDish(companionPool, adjacentCuisines, usedThisMeal) ?? pickDish(pool, adjacentCuisines, usedThisMeal);
          if (dish2) {
            usedThisMeal.add(dish2.id);
            markUsed(dish2);
            cuisinesByDay[day].push(dish2.cuisine);
          }

          items.push({
            day,
            meal,
            dishId: dish1.id,
            companionDishId: dish2?.id ?? null,
            template,
          });
        }
      }
    }
  }

  return items;
}

// ─── Public entry points ───────────────────────────────────────────────────

/**
 * Generates the weekly menu as soon as at least one member has completed
 * preferences (labelled "x/y preferences considered" in the UI), and
 * regenerates it — replacing items — every time another member completes
 * preferences, as long as the menu is still `pending` and nobody has
 * proposed an edit yet. Once locked (approved) or edited, it's frozen: new
 * preference submissions land in next week's cycle instead.
 */
export async function generateOrRegenerateWeeklyMenu(quadId: string) {
  const weekStart = currentWeekStart();

  const [quad, members] = await Promise.all([
    prisma.quad.findUniqueOrThrow({ where: { id: quadId } }),
    prisma.quadMember.findMany({ where: { quadId, status: "accepted" } }),
  ]);
  if (members.length === 0) return null;

  const existing = await prisma.weeklyMenu.findUnique({
    where: { quadId_weekStart: { quadId, weekStart } },
    include: { items: true },
  });

  // Frozen once locked, or once someone has proposed an edit — don't clobber
  // their work with a regeneration.
  if (existing && (existing.status !== "pending" || existing.items.some((i) => i.edited))) {
    return existing;
  }

  const { pool, composition, relaxedConsensus } = await buildSafePool(quadId, weekStart);
  if (pool.length === 0) return existing ?? null;

  const cookingStyle: "simple" | "standard" = quad.cookingStyle === "standard" ? "standard" : "simple";
  const nonVegDays = new Set(quad.nonVegDays);

  const weekTemplates = decideMealTemplates(cookingStyle, composition, nonVegDays);
  const menuItems = fillMenu(pool, weekTemplates, composition);
  if (menuItems.length === 0) return existing ?? null;

  if (existing) {
    await prisma.$transaction([
      prisma.menuItem.deleteMany({ where: { menuId: existing.id } }),
      prisma.menuItem.createMany({ data: menuItems.map((item) => ({ ...item, menuId: existing.id })) }),
      prisma.weeklyMenu.update({ where: { id: existing.id }, data: { relaxedConsensus } }),
    ]);
    return prisma.weeklyMenu.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true } });
  }

  return prisma.weeklyMenu.create({
    data: {
      quadId,
      weekStart,
      status: "pending",
      relaxedConsensus,
      approvalDeadline: new Date(Date.now() + APPROVAL_WINDOW_MS),
      items: { create: menuItems },
    },
    include: { items: true },
  });
}

/**
 * If a menu's 24-hour review window has closed and it never reached an
 * explicit majority decision, lock it anyway — silence shouldn't block
 * groceries forever, consistent with how ties already default to "yes"
 * elsewhere in the approval logic. No-op if already locked or still within
 * the window. Called lazily wherever a menu's lock state is read.
 */
export async function autoLockIfDeadlinePassed(menu: { id: string; status: string; approvalDeadline: Date | null }) {
  if (menu.status !== "pending" || !menu.approvalDeadline || Date.now() < menu.approvalDeadline.getTime()) {
    return;
  }
  await prisma.weeklyMenu.update({ where: { id: menu.id }, data: { status: "locked" } });
}
