import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DietaryFlagsForm } from "./dietary-flags-form";

export default async function DietaryFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ quadId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await searchParams;
  if (!quadId) redirect("/home-choice");

  const preference = await prisma.preference.findUnique({
    where: { userId_quadId: { userId: session.user.id, quadId } },
    include: { dishes: { include: { dish: true } } },
  });
  if (!preference) redirect(`/preferences/cuisine?quadId=${quadId}`);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 640 }}>
        <DietaryFlagsForm
          quadId={quadId}
          initialFlags={preference.dietaryFlags}
          pickedDishes={preference.dishes.map((pd) => ({
            name: pd.dish.name,
            containsFlags: pd.dish.containsFlags,
          }))}
        />
      </div>
    </div>
  );
}
