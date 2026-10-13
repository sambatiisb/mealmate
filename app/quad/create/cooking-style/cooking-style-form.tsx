"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCookingStyleAction, type QuadActionState } from "@/app/actions/quad";

const initialState: QuadActionState = {};

export function CookingStyleForm({ quadId }: { quadId: string }) {
  const [state, formAction, pending] = useActionState(saveCookingStyleAction, initialState);
  const router = useRouter();
  const [style, setStyle] = useState<"simple" | "standard" | "">("");
  const [staple, setStaple] = useState<"roti" | "rice">("roti");
  const [rotiQty, setRotiQty] = useState<number>(3);

  return (
    <>
      <div>
        <h6>Step 2 of 2</h6>
        <h2>How does your quad cook?</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          You&apos;re setting this for the whole quad. It shapes how many dishes get planned each meal.
        </p>
      </div>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <input type="hidden" name="quadId" value={quadId} />

        {/* Cooking Style */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Cooking style</div>

          <label
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              background: style === "simple" ? "var(--color-bg)" : "transparent",
              borderRadius: 14,
              padding: 14,
              border: `2px solid ${style === "simple" ? "var(--color-accent)" : "var(--border-input)"}`,
              cursor: "pointer",
            }}
          >
            <input type="radio" name="cookingStyle" value="simple" required onChange={() => setStyle("simple")} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Simple</div>
              <div className="text-muted" style={{ fontSize: 13 }}>1 curry + 1 staple per meal — lighter cooking load</div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              background: style === "standard" ? "var(--color-bg)" : "transparent",
              borderRadius: 14,
              padding: 14,
              border: `2px solid ${style === "standard" ? "var(--color-accent)" : "var(--border-input)"}`,
              cursor: "pointer",
            }}
          >
            <input type="radio" name="cookingStyle" value="standard" required onChange={() => setStyle("standard")} style={{ marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Standard</div>
              <div className="text-muted" style={{ fontSize: 13 }}>2 curries + 1 shared staple — more variety each meal</div>
            </div>
          </label>
        </div>

        {/* Default Staple */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Default staple</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["roti", "rice"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                data-selected={staple === s}
                onClick={() => setStaple(s)}
                style={{ flex: 1 }}
              >
                {s === "roti" ? "Roti" : "Rice"}
              </button>
            ))}
          </div>
          <input type="hidden" name="defaultStaple" value={staple} />
          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
            Each member can override their own choice per meal.
          </p>
        </div>

        {/* Roti quantity */}
        {staple === "roti" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Default roti quantity</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip"
                  data-selected={rotiQty === q}
                  onClick={() => setRotiQty(q)}
                  style={{ flex: 1 }}
                >
                  {q}
                </button>
              ))}
            </div>
            <input type="hidden" name="defaultRotiQty" value={rotiQty} />
          </div>
        )}

        {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || !style}>
            {pending ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </>
  );
}
