"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSkipAction } from "@/app/actions/menu";

export function SkipButton({ menuItemId, initiallySkipped }: { menuItemId: string; initiallySkipped: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        className="toggle"
        data-on={initiallySkipped}
        aria-label="Skip this meal"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await toggleSkipAction(menuItemId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong");
            }
          });
        }}
      >
        <span className="toggle-knob" />
      </button>
      {error && <p style={{ color: "var(--color-error)", fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
