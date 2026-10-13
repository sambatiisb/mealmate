import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserPrimaryQuad, getUserHasSubmittedPreferences } from "@/lib/quad";

// Always read from the database — never serve a cached version of this page
export const dynamic = "force-dynamic";

export default async function HomeChoicePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const quad = await getUserPrimaryQuad(session.user.id);
  if (quad) {
    const hasPreferences = await getUserHasSubmittedPreferences(session.user.id, quad.id);
    redirect(hasPreferences ? "/app/home" : `/preferences/cuisine?quadId=${quad.id}`);
  }

  return (
    <div className="auth-shell">
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ textAlign: "center" }}>
          <h2>Welcome, {session.user.name?.split(" ")[0]}</h2>
          <p className="text-muted" style={{ margin: 0 }}>Every meal plan starts with a quad.</p>
        </div>

        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <Link
            href="/quad/create"
            className="card-dark"
            style={{ flex: 1, minWidth: 220, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--color-accent)",
                color: "var(--color-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              +
            </div>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Create a Quad</span>
            <span style={{ fontSize: 13, color: "var(--color-purple-light)" }}>Start a new group and invite your mates</span>
          </Link>

          <Link
            href="/quad/join"
            className="card"
            style={{ flex: 1, minWidth: 220, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--color-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              #
            </div>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Join a Quad</span>
            <span className="text-muted" style={{ fontSize: 13 }}>Enter the invite code you were sent</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
