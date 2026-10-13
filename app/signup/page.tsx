"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h2>Create your account</h2>
          <p className="text-muted" style={{ margin: 0 }}>Just your name and mobile — no password needed.</p>
        </div>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <input className="input" name="firstName" placeholder="First name" required autoComplete="given-name" style={{ flex: 1, minWidth: 0 }} />
            <input className="input" name="lastName" placeholder="Last name" required autoComplete="family-name" style={{ flex: 1, minWidth: 0 }} />
          </div>
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
            {pending ? "Creating account…" : "Continue"}
          </button>
        </form>

        <p className="text-muted" style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
