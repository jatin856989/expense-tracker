"use client";

import * as React from "react";
import { toast } from "sonner";
import { BellPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { savePushSubscription } from "@/lib/actions/push";

const DISMISS_KEY = "notif-prompt-dismissed";

/** VAPID public keys are base64url — pushManager.subscribe wants raw bytes. */
function urlBase64ToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function noopSubscribe() {
  return () => {};
}

/**
 * Reads browser-only state safely across SSR/hydration — server always
 * sees "not eligible", client checks for real once hydrated. Checks
 * permission isn't denied rather than requiring it to still be "default":
 * a granted Notification permission doesn't by itself mean there's an
 * active push subscription (browser permission and pushManager.subscribe()
 * are two separate steps), so hiding the banner as soon as permission is
 * granted would strand anyone who granted it without ever completing
 * setup. Clicking Enable when permission is already granted just skips
 * straight to subscribing — requestPermission() is safe to call again.
 */
function getEligibleSnapshot() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (localStorage.getItem(DISMISS_KEY)) return false;
  return Notification.permission !== "denied";
}

function getServerSnapshot() {
  return false;
}

export function EnableNotificationsBanner() {
  const eligible = React.useSyncExternalStore(noopSubscribe, getEligibleSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const visible = eligible && !dismissed && !enabled;

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications weren't allowed — you can enable them later from your browser's site settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("Push isn't configured on this deployment.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Notifications enabled — you'll get a daily check-in for budgets, bills due and payments to confirm.");
      setEnabled(true);
    } catch {
      toast.error("Couldn't enable notifications on this device.");
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <BellPlus className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Get a daily check-in</p>
            <p className="text-xs text-muted-foreground">
              A once-a-day notification for budgets running high, bills due soon, and payments waiting to be confirmed.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" disabled={loading} onClick={handleEnable}>Enable</Button>
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={handleDismiss}>
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
