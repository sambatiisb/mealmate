"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function dismissNotificationAction(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/app", "layout");
}
