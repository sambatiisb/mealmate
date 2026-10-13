"use client";

import { useState, type RefObject } from "react";

export function ShareMenuButton({ targetRef, quadName }: { targetRef: RefObject<HTMLElement | null>; quadName: string }) {
  const [busy, setBusy] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleClick() {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(targetRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const fileName = `${quadName.replace(/\s+/g, "-").toLowerCase()}-menu.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (canNativeShare && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${quadName} — this week's menu` });
          return;
        } catch {
          // user cancelled the share sheet — fall through to download
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleClick}>
      {busy ? "Preparing…" : canNativeShare ? "Share menu" : "Download menu image"}
    </button>
  );
}
