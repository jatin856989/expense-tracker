import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createPendingFromImage } from "@/lib/actions/pending-transactions";

/**
 * Web Share Target endpoint (declared in app/manifest.ts) — this is what
 * makes "Expense Tracker" show up in Android's share sheet when you tap
 * Share on a GPay payment screenshot. The OS POSTs the shared file here as
 * multipart form data; this route reads it, hands it to the same
 * vision-extraction flow the portfolio screenshot importer uses, and
 * redirects back into the app. Runs inside the installed PWA's own browser
 * context, so the normal session cookie (and proxy.ts's login check) still
 * applies — an unauthenticated share just lands on /login.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("screenshot");

    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
      await createPendingFromImage(dataUrl);
    }
  } catch {
    // Best-effort: a failed share just lands back on the dashboard with
    // nothing new to review, same as a screenshot Groq couldn't parse.
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
