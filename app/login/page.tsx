"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h2>Welcome back</h2>
          <p className="text-muted" style={{ margin: 0 }}>Log in with your mobile number.</p>
        </div>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <input
            className="input"
            name="mobileNumber"
            type="tel"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            placeholder="10-digit mobile number"
            required
            autoComplete="tel"
          />

          {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
