import "dotenv/config";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Bool = "TRUE" | "FALSE" | boolean;
function parseBool(v: Bool): boolean {
  if (typeof v === "boolean") return v;
  return String(v).trim().toUpperCase() === "TRUE";
}

function placeholderImage(name: string) {
  return `https://placehold.co/400x300/eae9e9/201e1d?text=${encodeURIComponent(name)}`;
}

const DISH_ID_PATTERN = /^D\d{3}$/;

async function main() {
  const catalogPath = path.join(__dirname, "catalog.xlsx");
  const wb = XLSX.readFile(catalogPath);

  // ── Dishes ───────────────────────────────────────────────────────────────
  const dishRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets["Dishes"]);
  const flagRows: Record<string, unknown>[] = XLSX.utils
    .sheet_to_json<Record<string, unknown>>(wb.Sheets["Dish_Dietary_Flags"])
    .filter((r) => DISH_ID_PATTERN.test(String(r.dish_id ?? "")));

  const flagsByDishId = new Map<string, string[]>();
  for (const row of flagRows) {
    const flags: string[] = [];
    if (parseBool(row.violates_no_onion as Bool)) flags.push("onion");
    if (parseBool(row.violates_no_garlic as Bool)) flags.push("garlic");
    if (parseBool(row.violates_no_dairy as Bool)) flags.push("dairy");
    if (parseBool(row.violates_less_oil as Bool)) flags.push("oil");
    if (parseBool(row.violates_no_maida as Bool)) flags.push("maida");
    if (parseBool(row.violates_no_nuts as Bool)) flags.push("nuts");
    flagsByDishId.set(String(row.dish_id), flags);
  }

  // ── Purge stale pre-catalog dishes ──────────────────────────────────────
  // Before this XLSX-driven catalog existed, an earlier hardcoded seed created
  // ~64 curated dishes (e.g. "Amritsari Fish") with no catalogId. They're never
  // touched by the upsert below (it keys on catalogId), so they'd otherwise sit
  // in the catalog forever, polluting search/browse results. Delete anything
  // still safely deletable; leave alone anything an active menu still points at.
  const staleDishes = await prisma.dish.findMany({
    where: { source: "curated", catalogId: null },
    select: { id: true },
  });
  if (staleDishes.length > 0) {
    const staleIds = staleDishes.map((d) => d.id);
    console.log(`Purging ${staleIds.length} stale pre-catalog dishes…`);
    await prisma.preferenceDish.deleteMany({ where: { dishId: { in: staleIds } } });
    const referencing = await prisma.menuItem.findMany({
      where: {
        OR: [
          { dishId: { in: staleIds } },
          { companionDishId: { in: staleIds } },
          { priority1DishId: { in: staleIds } },
          { priority2DishId: { in: staleIds } },
        ],
      },
      select: { dishId: true, companionDishId: true, priority1DishId: true, priority2DishId: true },
    });
    const stillReferenced = new Set<string>();
    for (const item of referencing) {
      for (const id of [item.dishId, item.companionDishId, item.priority1DishId, item.priority2DishId]) {
        if (id && staleIds.includes(id)) stillReferenced.add(id);
      }
    }
    const deletableIds = staleIds.filter((id) => !stillReferenced.has(id));
    const { count } = await prisma.dish.deleteMany({ where: { id: { in: deletableIds } } });
    console.log(
      `Deleted ${count} stale dishes` +
        (stillReferenced.size > 0 ? ` (${stillReferenced.size} left in place — still referenced by an active menu).` : ".")
    );
  }

  console.log(`Seeding ${dishRows.length} dishes…`);
  const dishIdMap = new Map<string, string>();
  for (const row of dishRows) {
    const catalogId = String(row.dish_id);
    const isVeg = parseBool(row.is_veg as Bool);
    const containsEgg = parseBool(row.contains_egg as Bool);
    const isProteinRich = parseBool(row.is_protein_rich as Bool);
    const needsReview = parseBool(row.needs_manual_review as Bool);

    let foodType: "veg" | "nonveg" | "egg";
    if (!isVeg && containsEgg) foodType = "egg";
    else if (!isVeg) foodType = "nonveg";
    else if (containsEgg) foodType = "egg";
    else foodType = "veg";

    const containsFlags = flagsByDishId.get(catalogId) ?? [];
    const imageUrl = String(row.image_url ?? "").startsWith("http")
      ? String(row.image_url)
      : placeholderImage(String(row.name));

    const data = {
      name: String(row.name),
      cuisine: String(row.cuisine),
      subcategory: row.subcategory ? String(row.subcategory) : null,
      menuCategory: row.menu_category ? String(row.menu_category) : null,
      dishType: row.dish_type ? String(row.dish_type) : null,
      foodType,
      isVeg,
      containsEgg,
      isProteinRich: needsReview ? false : isProteinRich,
      proteinSourceType: row.protein_source_type && !needsReview
        ? String(row.protein_source_type)
        : null,
      imageUrl,
      source: "curated" as const,
      containsFlags,
      catalogId,
    };

    const dish = await prisma.dish.upsert({
      where: { catalogId },
      update: data,
      create: data,
    });
    dishIdMap.set(catalogId, dish.id);
  }

  // ── Ingredients ──────────────────────────────────────────────────────────
  const ingRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets["Ingredients"]);
  console.log(`Seeding ${ingRows.length} ingredients…`);
  const ingIdMap = new Map<string, string>();
  for (const row of ingRows) {
    const catalogId = String(row.ingredient_id);
    const data = {
      name: String(row.name),
      category: row.category ? String(row.category) : null,
      defaultUnit: row.default_unit ? String(row.default_unit) : null,
      isPerishable: parseBool(row.is_perishable as Bool),
      typicalQcAvailability: row.typical_qc_availability
        ? String(row.typical_qc_availability)
        : null,
      containsOnion: parseBool(row.contains_onion as Bool),
      containsGarlic: parseBool(row.contains_garlic as Bool),
      containsDairy: parseBool(row.contains_dairy as Bool),
      containsGluten: parseBool(row.contains_gluten as Bool),
      containsNuts: parseBool(row.contains_nuts as Bool),
      catalogId,
    };
    const ing = await prisma.ingredient.upsert({
      where: { catalogId },
      update: data,
      create: data,
    });
    ingIdMap.set(catalogId, ing.id);
  }

  // ── Dish ↔ Ingredient links ───────────────────────────────────────────────
  const diRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets["Dish_Ingredients"]);
  console.log(`Seeding ${diRows.length} dish-ingredient links…`);

  // Batch: clear and re-create to handle catalog updates cleanly
  const dishIdsToReset = new Set(
    diRows
      .map((r) => dishIdMap.get(String(r.dish_id)))
      .filter(Boolean) as string[]
  );
  if (dishIdsToReset.size > 0) {
    await prisma.dishIngredient.deleteMany({
      where: { dishId: { in: [...dishIdsToReset] } },
    });
  }

  const diData = diRows
    .map((row) => {
      const dishId = dishIdMap.get(String(row.dish_id));
      const ingredientId = ingIdMap.get(String(row.ingredient_id));
      if (!dishId || !ingredientId) return null;
      return {
        dishId,
        ingredientId,
        quantity: row.quantity_per_serving ? Number(row.quantity_per_serving) : null,
        unit: row.unit ? String(row.unit) : null,
        isOptional: parseBool(row.is_optional as Bool),
        seqInDish: row.seq_in_dish ? Number(row.seq_in_dish) : null,
      };
    })
    .filter(Boolean) as {
    dishId: string;
    ingredientId: string;
    quantity: number | null;
    unit: string | null;
    isOptional: boolean;
    seqInDish: number | null;
  }[];

  await prisma.dishIngredient.createMany({ data: diData, skipDuplicates: true });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
