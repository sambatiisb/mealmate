"use client";

import { useTransition } from "react";
import { dismissNotificationAction } from "@/app/actions/notifications";

export interface NotificationView {
  id: string;
  message: string;
}

export function NotificationBanner({ notifications }: { notifications: NotificationView[] }) {
  const [pending, startTransition] = useTransition();

  if (notifications.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          className="note-purple"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        >
          <span>{n.message}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => { await dismissNotificationAction(n.id); })}
            aria-label="Dismiss"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
