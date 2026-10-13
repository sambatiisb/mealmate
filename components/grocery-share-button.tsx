"use client";

import { useState } from "react";

export function GroceryShareButton({ quadName, text }: { quadName: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleClick() {
    if (canNativeShare) {
      try {
        await navigator.share({ title: `Groceries — ${quadName}`, text });
        return;
      } catch {
        // user cancelled the share sheet — fall through to clipboard copy
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={handleClick}>
      {copied ? "Copied ✓" : canNativeShare ? "Share list" : "Copy list"}
    </button>
  );
}
