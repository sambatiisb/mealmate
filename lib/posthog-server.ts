import { PostHog } from "posthog-node";

let client: PostHog | undefined;

export function posthogServer(): PostHog {
  if (!client) {
    client = new PostHog(process.env.POSTHOG_KEY ?? "", {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  posthogServer().capture({ distinctId, event, properties });
  await posthogServer().flush();
}
