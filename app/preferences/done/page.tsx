import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PreferencesDonePage({
  searchParams,
}: {
  searchParams: Promise<{ quadId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { quadId } = await searchParams;
  if (!quadId) redirect("/home-choice");

  const [quad, totalMembers, responded] = await Promise.all([
    prisma.quad.findUniqueOrThrow({ where: { id: quadId } }),
    prisma.quadMember.count({ where: { quadId, status: "accepted" } }),
    prisma.preference.count({ where: { quadId, completedAt: { not: null } } }),
  ]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 460, alignItems: "center", textAlign: "center", padding: "var(--space-8)" }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          ✓
        </div>
        <h2 style={{ margin: 0 }}>Preferences saved</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          Your weekly menu is ready based on{" "}
          <strong style={{ color: "var(--color-text)" }}>
            {responded}/{totalMembers}
          </strong>{" "}
          quad-mates who&apos;ve set preferences.
        </p>
        <Link href="/app/home" className="btn btn-primary" style={{ marginTop: 8 }}>
          Go to my quad
        </Link>
      </div>
    </div>
  );
}
