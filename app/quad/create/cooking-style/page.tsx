import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CookingStyleForm } from "./cooking-style-form";

export default async function CookingStylePage({
  searchParams,
}: {
  searchParams: Promise<{ quadId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await searchParams;
  if (!quadId) redirect("/home-choice");

  const quad = await prisma.quad.findUnique({ where: { id: quadId } });
  if (!quad || quad.createdBy !== session.user.id) redirect("/home-choice");

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <CookingStyleForm quadId={quadId} />
      </div>
    </div>
  );
}
