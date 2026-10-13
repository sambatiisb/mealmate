"use client";

import { useActionState } from "react";
import { saveNonVegDaysAction, type QuadActionState } from "@/app/actions/quad";

const initialState: QuadActionState = {};

export function NonVegDaysForm({
  quadId,
  dayLabels,
  existing,
}: {
  quadId: string;
  dayLabels: string[];
  existing: number[];
}) {
  const [state, formAction, pending] = useActionState(saveNonVegDaysAction, initialState);
  const existingSet = new Set(existing);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <input type="hidden" name="quadId" value={quadId} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {dayLabels.map((label, i) => (
          <label key={label} className="day-toggle day-toggle-nonveg">
            <input type="checkbox" name={`nonveg-${i}`} defaultChecked={existingSet.has(i)} />
            {label.slice(0, 3)}
          </label>
        ))}
      </div>

      {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: "flex-start", marginTop: 4 }}>
        {pending ? "Saving…" : "Save non-veg days"}
      </button>
    </form>
  );
}
