"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSkipWindowOpen, isBeforeMealCutoff } from "@/lib/cutoffs";
import { computeApprovalResult } from "@/lib/approvals";
import { sendNotification } from "@/lib/notifications";
import { captureServerEvent } from "@/lib/posthog-server";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function toggleSkipAction(menuItemId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id: menuItemId },
    include: { menu: { include: { quad: true } } },
  });

  if (!isSkipWindowOpen(item.meal, item.day, item.menu.quad)) {
    throw new Error(`Too late to skip — the ${item.meal} skip window has closed`);
  }

  const existing = await prisma.skip.findUnique({
    where: { userId_menuItemId: { userId, menuItemId } },
  });

  if (existing) {
    await prisma.skip.delete({ where: { id: existing.id } });
    await captureServerEvent(userId, "meal_unskipped", {
      menuItemId,
      meal: item.meal,
      day: item.day,
    });
  } else {
    await prisma.skip.create({ data: { userId, menuItemId } });
    await captureServerEvent(userId, "meal_skipped", {
      menuItemId,
      meal: item.meal,
      day: item.day,
    });
  }

  revalidatePath("/app/home");
}

export async function nudgeAction(quadId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [members, preferences] = await Promise.all([
    prisma.quadMember.findMany({ where: { quadId, status: "accepted" } }),
    prisma.preference.findMany({ where: { quadId, completedAt: { not: null } } }),
  ]);
  const responded = new Set(preferences.map((p) => p.userId));
  const pending = members.filter((m) => !responded.has(m.userId));

  await Promise.all(
    pending.map((m) =>
      sendNotification({
        userId: m.userId,
        quadId,
        type: "nudge_preferences",
        message: "A quad-mate nudged you to set your food preferences.",
      })
    )
  );

  revalidatePath("/app/home");
  return { nudged: pending.length };
}

export async function proposeEditAction(menuItemId: string, newDishId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id: menuItemId },
    include: { menu: { include: { quad: true } } },
  });

  if (item.menu.approvalDeadline && Date.now() >= item.menu.approvalDeadline.getTime()) {
    throw new Error("Too late to edit — this week's 24-hour review window has closed");
  }
  if (!isBeforeMealCutoff(item.meal, item.day, item.menu.quad)) {
    throw new Error(`Too late to edit — the ${item.meal} cutoff has passed`);
  }

  // Anyone who'd already approved is about to have that approval cleared by
  // this new proposal — they need a distinct nudge explaining why they're
  // being asked to vote again, not just a generic "something changed."
  const priorApprovals = await prisma.approval.findMany({
    where: { menuId: item.menuId, approved: true },
    select: { userId: true },
  });
  const priorApproverIds = new Set(priorApprovals.map((a) => a.userId));

  await prisma.$transaction([
    prisma.approval.deleteMany({ where: { menuId: item.menuId } }),
    prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        edited: true,
        priority1DishId: newDishId,
        priority2DishId: item.dishId,
      },
    }),
  ]);

  const members = await prisma.quadMember.findMany({
    where: { quadId: item.menu.quadId, status: "accepted" },
  });
  const proposerName = session.user.name ?? "A quad-mate";
  const dayLabel = DAY_NAMES[item.day];
  await Promise.all(
    members
      .filter((m) => m.userId !== userId)
      .map((m) => {
        const needsReapproval = priorApproverIds.has(m.userId);
        return sendNotification({
          userId: m.userId,
          quadId: item.menu.quadId,
          type: needsReapproval ? "reapproval_needed" : "menu_edited",
          message: needsReapproval
            ? `${proposerName} proposed a new swap for ${dayLabel} ${item.meal} — your earlier approval was reset, please review and re-approve.`
            : `${proposerName} proposed swapping ${dayLabel} ${item.meal} — take a look and approve or reject.`,
        });
      })
  );

  revalidatePath("/app/menu");
}

export async function approveMenuAction(menuId: string, approved: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const userId = session.user.id;

  const menu = await prisma.weeklyMenu.findUniqueOrThrow({ where: { id: menuId } });

  await prisma.approval.upsert({
    where: { menuId_userId: { menuId, userId } },
    update: { approved, respondedAt: new Date() },
    create: { menuId, userId, approved },
  });

  const [totalMembers, approvals] = await Promise.all([
    prisma.quadMember.count({ where: { quadId: menu.quadId, status: "accepted" } }),
    prisma.approval.findMany({ where: { menuId } }),
  ]);

  const result = computeApprovalResult(totalMembers, approvals);

  if (result.decided) {
    if (result.passed) {
      await prisma.weeklyMenu.update({ where: { id: menuId }, data: { status: "locked" } });
    } else {
      // Rejected edit(s) — revert any edited items back to their original pick.
      const editedItems = await prisma.menuItem.findMany({ where: { menuId, edited: true } });
      await prisma.$transaction(
        editedItems.map((item) =>
          prisma.menuItem.update({
            where: { id: item.id },
            data: { edited: false, priority1DishId: null, priority2DishId: null },
          })
        )
      );
    }

    await prisma.approval.deleteMany({ where: { menuId } });

    const members = await prisma.quadMember.findMany({
      where: { quadId: menu.quadId, status: "accepted" },
    });
    await Promise.all(
      members.map((m) =>
        sendNotification({
          userId: m.userId,
          quadId: menu.quadId,
          type: result.passed ? "edit_approved" : "edit_rejected",
          message: result.passed
            ? "This week's menu was approved and is now locked in."
            : "A proposed menu edit was rejected — the original dish stays.",
        })
      )
    );
  }

  revalidatePath("/app/menu");
  return result;
}
