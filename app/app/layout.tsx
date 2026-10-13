import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPrimaryQuad } from "@/lib/quad";
import { TabBar } from "@/components/tab-bar";
import { NotificationBanner } from "@/components/notification-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quad = await getUserPrimaryQuad(session.user.id);
  if (!quad) redirect("/home-choice");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, message: true },
  });

  return (
    <div className="app-shell">
      <TabBar />
      <main className="app-content">
        <NotificationBanner notifications={notifications} />
        {children}
      </main>
    </div>
  );
}
