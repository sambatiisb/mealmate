"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrRegenerateWeeklyMenu } from "@/lib/menu-generation";
import { captureServerEvent } from "@/lib/posthog-server";
import { MIN_DISHES_REQUIRED } from "@/lib/constants";

export interface PrefActionState {
  error?: string;
}

/** Persists the member's veg-only flag immediately (called on toggle). */
export async function setVegOnlyAction(vegOnly: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { vegOnly, vegOnlyConfirmed: true },
  });
}

const dishesSchema = z.object({
  quadId: z.string().min(1),
  dishIds: z.string(),
});

export async function saveDishesAction(
  _prevState: PrefActionState,
  formData: FormData
): Promise<PrefActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = dishesSchema.safeParse({
    quadId: formData.get("quadId"),
    dishIds: formData.get("dishIds"),
  });
  if (!parsed.success) return { error: "Something went wrong" };

  const dishIds = parsed.data.dishIds.split(",").filter(Boolean);
  if (dishIds.length < MIN_DISHES_REQUIRED) {
    return { error: `Pick at least ${MIN_DISHES_REQUIRED} dishes to continue` };
  }

  // Upsert preference (no cuisines/foodType — those are gone in v2)
  const preference = await prisma.preference.upsert({
    where: { userId_quadId: { userId: session.user.id, quadId: parsed.data.quadId } },
    update: {},
    create: {
      userId: session.user.id,
      quadId: parsed.data.quadId,
      dietaryFlags: [],
    },
  });

  await prisma.preferenceDish.deleteMany({ where: { preferenceId: preference.id } });
  await prisma.preferenceDish.createMany({
    data: dishIds.map((dishId) => ({ preferenceId: preference.id, dishId })),
  });

  redirect(`/preferences/dietary-flags?quadId=${parsed.data.quadId}`);
}

const dietaryFlagsSchema = z.object({
  quadId: z.string().min(1),
  flags: z.string().optional(),
});

export async function saveDietaryFlagsAction(
  _prevState: PrefActionState,
  formData: FormData
): Promise<PrefActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = dietaryFlagsSchema.safeParse({
    quadId: formData.get("quadId"),
    flags: formData.get("flags"),
  });
  if (!parsed.success) return { error: "Something went wrong" };

  const dietaryFlags = (parsed.data.flags ?? "").split(",").filter(Boolean);

  await prisma.preference.update({
    where: { userId_quadId: { userId: session.user.id, quadId: parsed.data.quadId } },
    data: { dietaryFlags, completedAt: new Date() },
  });

  await captureServerEvent(session.user.id, "preferences_completed", {
    quadId: parsed.data.quadId,
  });

  await generateOrRegenerateWeeklyMenu(parsed.data.quadId);

  redirect(`/preferences/done?quadId=${parsed.data.quadId}`);
}
