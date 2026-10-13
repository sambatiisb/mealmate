import { prisma } from "@/lib/prisma";

/** Students belong to a single quad in this MVP (multi-quad/dual-role is explicitly out of scope). */
export async function getUserPrimaryQuad(userId: string) {
  const membership = await prisma.quadMember.findFirst({
    where: { userId, status: "accepted" },
    include: { quad: true },
    orderBy: { joinedAt: "asc" },
  });
  return membership?.quad ?? null;
}

export async function getUserHasSubmittedPreferences(userId: string, quadId: string) {
  const pref = await prisma.preference.findUnique({
    where: { userId_quadId: { userId, quadId } },
  });
  return Boolean(pref?.completedAt);
}
