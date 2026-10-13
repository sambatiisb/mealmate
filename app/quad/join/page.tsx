"use client";

import { useActionState } from "react";
import { joinQuadAction, type QuadActionState } from "@/app/actions/quad";

const initialState: QuadActionState = {};

export default function JoinQuadPage() {
  const [state, formAction, pending] = useActionState(joinQuadAction, initialState);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div>
          <h2>Join a quad</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Enter the invite code your quad-mate shared with you.
          </p>
        </div>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <input
            className="input"
            name="inviteCode"
            placeholder="Invite code, e.g. QK-8F2K"
            required
            autoComplete="off"
            style={{ textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", fontWeight: 700, fontSize: 16 }}
          />

          {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
            {pending ? "Joining…" : "Continue to preferences"}
          </button>
        </form>
      </div>
    </div>
  );
}
