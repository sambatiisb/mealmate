"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const addDishSchema = z.object({
  quadId: z.string().min(1),
  name: z.string().trim().min(1),
  cuisine: z.string().trim().min(1),
  foodType: z.enum(["veg", "nonveg", "egg"]),
});

export async function addCustomDishAction(input: {
  quadId: string;
  name: string;
  cuisine: string;
  foodType: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = addDishSchema.parse(input);

  const dish = await prisma.dish.create({
    data: {
      name: parsed.name,
      cuisine: parsed.cuisine,
      foodType: parsed.foodType,
      imageUrl: `https://placehold.co/400x300/eae9e9/201e1d?text=${encodeURIComponent(parsed.name)}`,
      source: "custom",
      quadId: parsed.quadId,
      addedBy: session.user.id,
      containsFlags: [],
    },
  });

  return dish;
}
