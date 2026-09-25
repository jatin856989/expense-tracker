import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set.");
  webpush.setVapidDetails("mailto:ankit.altruist.india@gmail.com", publicKey, privateKey);
  configured = true;
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Sends one push message to every subscribed device. A subscription that
 * the push service reports as gone (410) or not found (404) — the user
 * uninstalled the PWA, cleared site data, revoked the permission — is
 * deleted rather than retried forever.
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  ensureConfigured();

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (e) {
        const statusCode = (e as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) deadIds.push(sub.id);
      }
    })
  );

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } });
  }

  return { sent, removed: deadIds.length };
}
