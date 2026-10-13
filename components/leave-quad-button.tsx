"use client";

import { useTransition } from "react";
import { leaveQuadAction } from "@/app/actions/quad";

export function LeaveQuadButton({ quadId, quadName }: { quadId: string; quadName: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Leave "${quadName}"? Your preferences, picks, and votes for this quad will be cleared. You can join or create another quad afterward.`)) {
      return;
    }
    startTransition(async () => {
      await leaveQuadAction(quadId);
    });
  }

  return (
    <button type="button" className="btn btn-secondary" disabled={pending} onClick={handleClick} style={{ color: "var(--color-error)", flex: 1 }}>
      {pending ? "Leaving…" : "Leave quad"}
    </button>
  );
}
