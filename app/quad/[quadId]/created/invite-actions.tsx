"use client";

import { useState } from "react";

export function InviteActions({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappText = encodeURIComponent(
    `Join my MealMate quad! Use invite code: ${inviteCode}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <div style={{ display: "flex", gap: 10, width: "100%" }}>
      <button
        type="button"
        className="btn btn-primary"
        style={{ flex: 1 }}
        onClick={copyCode}
      >
        {copied ? "Copied!" : "Copy code"}
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost"
        style={{ flex: 1 }}
      >
        Share via WhatsApp
      </a>
    </div>
  );
}
