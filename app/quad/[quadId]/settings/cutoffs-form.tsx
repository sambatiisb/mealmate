"use client";

import { useActionState } from "react";
import { saveQuadCutoffsAction, type QuadActionState } from "@/app/actions/quad";

const initialState: QuadActionState = {};

export function CutoffsForm({
  quadId,
  lunchCutoff,
  dinnerCutoff,
}: {
  quadId: string;
  lunchCutoff: string;
  dinnerCutoff: string;
}) {
  const [state, formAction, pending] = useActionState(saveQuadCutoffsAction, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <input type="hidden" name="quadId" value={quadId} />
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="lunchCutoff">Lunch cutoff</label>
          <input className="input" id="lunchCutoff" name="lunchCutoff" type="time" defaultValue={lunchCutoff} required />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="dinnerCutoff">Dinner cutoff</label>
          <input className="input" id="dinnerCutoff" name="dinnerCutoff" type="time" defaultValue={dinnerCutoff} required />
        </div>
      </div>
      {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}
      <button type="submit" className="btn btn-secondary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save cutoffs"}
      </button>
    </form>
  );
}
