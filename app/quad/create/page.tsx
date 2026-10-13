"use client";

import { useActionState } from "react";
import { createQuadAction, type QuadActionState } from "@/app/actions/quad";

const initialState: QuadActionState = {};

export default function CreateQuadPage() {
  const [state, formAction, pending] = useActionState(createQuadAction, initialState);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ margin: 0 }}>Name your quad</h2>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <input className="input" name="name" required placeholder="e.g. Hostel Block C" />

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)", marginTop: 4 }}>
            Add quad-mates by mobile number
          </div>
          <textarea
            className="input"
            name="mobileNumbers"
            placeholder="One per line — just for identification, they'll join with an invite code"
          />

          {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
            {pending ? "Creating…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
