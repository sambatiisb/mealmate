"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDietaryFlagsAction, type PrefActionState } from "@/app/actions/preferences";

const initialState: PrefActionState = {};

const FLAGS: { key: string; label: string }[] = [
  { key: "onion", label: "No onions" },
  { key: "garlic", label: "No garlic" },
  { key: "dairy", label: "No dairy" },
  { key: "oil", label: "Less oil" },
  { key: "maida", label: "No maida" },
  { key: "nuts", label: "Nut allergy" },
];

export function DietaryFlagsForm({
  quadId,
  initialFlags,
  pickedDishes,
}: {
  quadId: string;
  initialFlags: string[];
  pickedDishes: { name: string; containsFlags: string[] }[];
}) {
  const [state, formAction, pending] = useActionState(saveDietaryFlagsAction, initialState);
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialFlags);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  const conflicts = useMemo(() => {
    return pickedDishes
      .map((dish) => ({
        name: dish.name,
        matchedFlags: selected.filter((f) => dish.containsFlags.includes(f)),
      }))
      .filter((d) => d.matchedFlags.length > 0);
  }, [pickedDishes, selected]);

  return (
    <>
      <div>
        <h6>Dietary flags</h6>
        <h2>Any dietary flags?</h2>
        <p className="text-muted" style={{ margin: 0 }}>Optional — helps us flag conflicting dishes.</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {FLAGS.map((flag) => (
          <button
            key={flag.key}
            type="button"
            className="chip"
            data-selected={selected.includes(flag.key)}
            onClick={() => toggle(flag.key)}
          >
            {flag.label}
          </button>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="note-purple" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>Heads up</strong>
          {conflicts.map((c) => (
            <p key={c.name} style={{ margin: 0 }}>
              <strong>{c.name}</strong> contains {c.matchedFlags.join(", ")} — pick anyway?
            </p>
          ))}
          <Link href={`/preferences/dishes?quadId=${quadId}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
            Change my dish picks
          </Link>
        </div>
      )}

      <form action={formAction} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <input type="hidden" name="quadId" value={quadId} />
        <input type="hidden" name="flags" value={selected.join(",")} />
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Back
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Finishing…" : "Finish"}
          </button>
        </div>
      </form>
    </>
  );
}
