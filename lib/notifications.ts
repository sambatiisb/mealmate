import { prisma } from "@/lib/prisma";

type NotificationType =
  | "nudge_preferences"
  | "menu_ready"
  | "menu_edited"
  | "reapproval_needed"
  | "edit_approved"
  | "edit_rejected";

interface SendNotificationInput {
  userId: string;
  quadId: string;
  type: NotificationType;
  message: string;
}

/**
 * Single choke point for all outbound notifications. Persists to the
 * `Notification` table and surfaces as an in-app banner on next app open
 * (see components/notification-banner.tsx) — the cheapest thing that's
 * still genuinely useful for a "check the app once a day" pattern, with
 * zero new delivery infrastructure. Swap the body for a WhatsApp Business
 * Platform template send (Twilio or Meta Cloud API) in Phase 2 without
 * touching any call site.
 */
export async function sendNotification({ userId, quadId, type, message }: SendNotificationInput): Promise<void> {
  await prisma.notification.create({ data: { userId, quadId, type, message } });
}
