"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => signOut({ callbackUrl: "/" })}>
      Log out
    </button>
  );
}
