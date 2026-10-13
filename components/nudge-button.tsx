"use client";

import { useState, useTransition } from "react";
import { nudgeAction } from "@/app/actions/menu";

export function NudgeButton({ quadId }: { quadId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await nudgeAction(quadId);
            setMessage(
              result.nudged > 0 ? `Nudged ${result.nudged} quad-mate${result.nudged === 1 ? "" : "s"}` : "Everyone's already responded"
            );
          });
        }}
      >
        {pending ? "Nudging…" : "Nudge quad-mates"}
      </button>
      {message && <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{message}</p>}
    </div>
  );
}
