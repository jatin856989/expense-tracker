"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "./require-auth";
import { toErrorMessage } from "./shared";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(sub: PushSubscriptionInput): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  return { success: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  return { success: true };
}
