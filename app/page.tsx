import Link from "next/link";

export default function SplashPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-dark)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8) var(--space-4)",
        textAlign: "center",
        gap: "var(--space-6)",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 20,
          background: "var(--color-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          fontWeight: 800,
          color: "var(--color-dark)",
        }}
      >
        Q
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
        <h1 style={{ color: "#fff", letterSpacing: "-0.5px" }}>MealMate</h1>
        <p style={{ color: "var(--color-purple-light)", fontWeight: 500, margin: 0 }}>
          Shared meals, sorted by your quad — pick preferences once, let the
          week&apos;s menu run itself.
        </p>
      </div>
      <Link href="/signup" className="btn btn-accent" style={{ marginTop: 12, padding: "16px 36px" }}>
        Get started
      </Link>
      <Link href="/login" className="btn btn-ghost" style={{ color: "var(--color-purple-light)" }}>
        I already have an account
      </Link>
    </div>
  );
}
