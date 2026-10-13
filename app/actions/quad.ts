"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";
import { captureServerEvent } from "@/lib/posthog-server";

export interface QuadActionState {
  error?: string;
}

const createQuadSchema = z.object({
  name: z.string().trim().min(1, "Give your quad a name"),
  mobileNumbers: z.string().optional(),
});

export async function createQuadAction(
  _prevState: QuadActionState,
  formData: FormData
): Promise<QuadActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const parsed = createQuadSchema.safeParse({
    name: formData.get("name"),
    mobileNumbers: formData.get("mobileNumbers"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details" };
  }

  const invitedMobileNumbers = (parsed.data.mobileNumbers ?? "")
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean);

  let inviteCode = generateInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const clash = await prisma.quad.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode();
  }

  const quad = await prisma.quad.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      createdBy: userId,
      invitedMobileNumbers,
      members: { create: { userId, status: "accepted" } },
    },
  });

  await captureServerEvent(userId, "quad_created", { quadId: quad.id });

  redirect(`/quad/create/cooking-style?quadId=${quad.id}`);
}

const joinQuadSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Enter the invite code your quad-mate shared"),
});

export async function joinQuadAction(
  _prevState: QuadActionState,
  formData: FormData
): Promise<QuadActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const parsed = joinQuadSchema.safeParse({ inviteCode: formData.get("inviteCode") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid code" };
  }

  const quad = await prisma.quad.findUnique({ where: { inviteCode: parsed.data.inviteCode } });
  if (!quad) {
    return { error: "We couldn't find a quad with that code" };
  }

  const existing = await prisma.quadMember.findUnique({
    where: { userId_quadId: { userId, quadId: quad.id } },
  });
  if (!existing) {
    await prisma.quadMember.create({ data: { userId, quadId: quad.id, status: "accepted" } });
    await captureServerEvent(userId, "quad_joined", { quadId: quad.id });
  }

  redirect(`/preferences/dishes?quadId=${quad.id}`);
}

const cookingStyleSchema = z.object({
  quadId: z.string().min(1),
  cookingStyle: z.enum(["simple", "standard"]),
  defaultStaple: z.enum(["roti", "rice"]),
  defaultRotiQty: z.coerce.number().int().min(1).max(10).optional(),
});

export async function saveCookingStyleAction(
  _prevState: QuadActionState,
  formData: FormData
): Promise<QuadActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = cookingStyleSchema.safeParse({
    quadId: formData.get("quadId"),
    cookingStyle: formData.get("cookingStyle"),
    defaultStaple: formData.get("defaultStaple"),
    defaultRotiQty: formData.get("defaultRotiQty") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fill in all fields" };
  }

  const quad = await prisma.quad.findUnique({ where: { id: parsed.data.quadId } });
  if (!quad) return { error: "Quad not found" };
  if (quad.createdBy !== session.user.id) {
    return { error: "Only the quad creator can set this" };
  }

  await prisma.quad.update({
    where: { id: parsed.data.quadId },
    data: {
      cookingStyle: parsed.data.cookingStyle,
      defaultStaple: parsed.data.defaultStaple,
      defaultRotiQty: parsed.data.defaultRotiQty ?? null,
    },
  });

  redirect(`/quad/${parsed.data.quadId}/created`);
}

const cutoffTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

const cutoffsSchema = z.object({
  quadId: z.string().min(1),
  lunchCutoff: cutoffTimeSchema,
  dinnerCutoff: cutoffTimeSchema,
});

export async function saveQuadCutoffsAction(
  _prevState: QuadActionState,
  formData: FormData
): Promise<QuadActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = cutoffsSchema.safeParse({
    quadId: formData.get("quadId"),
    lunchCutoff: formData.get("lunchCutoff"),
    dinnerCutoff: formData.get("dinnerCutoff"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter valid cutoff times" };
  }

  const quad = await prisma.quad.findUnique({ where: { id: parsed.data.quadId } });
  if (!quad) return { error: "Quad not found" };
  if (quad.createdBy !== session.user.id) {
    return { error: "Only the quad creator can change cutoffs" };
  }

  await prisma.quad.update({
    where: { id: parsed.data.quadId },
    data: { lunchCutoff: parsed.data.lunchCutoff, dinnerCutoff: parsed.data.dinnerCutoff },
  });

  redirect(`/quad/${parsed.data.quadId}/settings`);
}

/**
 * Leaving resets the member back to a clean slate — their preferences, picks,
 * skips, and votes for this quad are gone, matching "quit and start fresh."
 * Custom dishes they added stay (shared, still useful to the rest of the quad).
 */
export async function leaveQuadAction(quadId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  await prisma.$transaction([
    prisma.skip.deleteMany({ where: { userId, menuItem: { menu: { quadId } } } }),
    prisma.approval.deleteMany({ where: { userId, menu: { quadId } } }),
    prisma.preferenceDish.deleteMany({ where: { preference: { userId, quadId } } }),
    prisma.preference.deleteMany({ where: { userId, quadId } }),
    prisma.quadMember.deleteMany({ where: { userId, quadId } }),
  ]);

  await captureServerEvent(userId, "quad_left", { quadId });

  redirect("/home-choice");
}

export async function saveNonVegDaysAction(
  _prevState: QuadActionState,
  formData: FormData
): Promise<QuadActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quadId = String(formData.get("quadId") ?? "");
  const quad = await prisma.quad.findUnique({ where: { id: quadId } });
  if (!quad) return { error: "Quad not found" };
  if (quad.createdBy !== session.user.id) {
    return { error: "Only the quad creator can change this" };
  }

  const nonVegDays = [0, 1, 2, 3, 4, 5, 6].filter((i) => formData.get(`nonveg-${i}`) === "on");

  await prisma.quad.update({ where: { id: quadId }, data: { nonVegDays } });

  redirect(`/quad/${quadId}/settings`);
}
