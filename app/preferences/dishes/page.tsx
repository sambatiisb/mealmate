import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DishesForm } from "./dishes-form";

export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<{ quadId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await searchParams;
  if (!quadId) redirect("/home-choice");

  const [pref, categoryRows, user] = await Promise.all([
    prisma.preference.findUnique({
      where: { userId_quadId: { userId: session.user.id, quadId } },
      include: { dishes: { include: { dish: true } } },
    }),
    prisma.dish.findMany({
      where: { OR: [{ source: "curated" }, { quadId }], menuCategory: { not: null } },
      select: { menuCategory: true },
      orderBy: { menuCategory: "asc" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { vegOnly: true },
    }),
  ]);

  const menuCategories = [...new Set(categoryRows.map((r) => r.menuCategory!))];

  const initialDishes =
    pref?.dishes.map((pd) => ({
      id: pd.dish.id,
      name: pd.dish.name,
      cuisine: pd.dish.cuisine,
      subcategory: pd.dish.subcategory ?? null,
      isVeg: pd.dish.isVeg,
      foodType: pd.dish.foodType,
      imageUrl: pd.dish.imageUrl,
      containsFlags: pd.dish.containsFlags,
    })) ?? [];

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 680 }}>
        <DishesForm
          quadId={quadId}
          menuCategories={menuCategories}
          initialDishes={initialDishes}
          initialVegOnly={user.vegOnly}
        />
      </div>
    </div>
  );
}
