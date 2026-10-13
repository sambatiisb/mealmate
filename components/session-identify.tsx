"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

/** Ties PostHog's distinct_id to the real logged-in user, per CLAUDE.md — never a shared placeholder. */
export function SessionIdentify() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (posthog.get_distinct_id() === session.user.id) return;
    posthog.identify(session.user.id, { mobileNumber: session.user.mobileNumber });
  }, [status, session]);

  return null;
}
