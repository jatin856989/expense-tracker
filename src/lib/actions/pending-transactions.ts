"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkAllBudgetAlerts, formatBudgetAlert } from "@/lib/budget-alerts";
import { extractedPaymentSchema, confirmPendingSchema } from "@/lib/validations-pending";
import { ActionState, emptyToNull, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

// Same deprecation-prone Groq vision model as the portfolio screenshot
// importer — kept as a separate env override in case the two ever need to
// diverge, but defaults to the same model.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

// Text model — same one voice entry already uses (deprecation-prone, hence
// the env override), just repurposed here for reading a shared SMS instead
// of a spoken transcript.
const GROQ_TEXT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const IMAGE_SYSTEM_PROMPT = `You read a screenshot of a UPI payment confirmation (Google Pay, PhonePe, Paytm, or similar). Respond with ONLY a JSON object, no other text.

Extract:
- "amount": the amount paid, as a plain number with no currency symbol, or null if not clearly visible
- "payee": the name of the person or merchant the payment was made to, or null if not visible
- "date": the payment date in YYYY-MM-DD format if visible, else null (if only a time is shown with no date, assume today and still return null — do not guess a date)
- "isPayment": true if this image is genuinely a payment *you made* (a "payment successful" / "sent" confirmation), false if it's clearly something else (money received instead, a random photo, an unrelated screenshot, etc.)

Respond with exactly this shape:
{"amount": <number or null>, "payee": <string or null>, "date": <"YYYY-MM-DD" or null>, "isPayment": <true or false>}`;

const TEXT_SYSTEM_PROMPT = `You read a bank or UPI SMS/notification about a transaction. Respond with ONLY a JSON object, no other text.

Extract:
- "amount": the transaction amount, as a plain number with no currency symbol, or null if not clearly stated
- "payee": the merchant/person name the money went to, if stated, else null
- "date": the transaction date in YYYY-MM-DD format if stated, else null (do not guess one)
- "isPayment": true only if this is money the account holder PAID OUT (debited, sent, spent) — false if it's money they RECEIVED (credited, refund) or if the text isn't a transaction message at all

Respond with exactly this shape:
{"amount": <number or null>, "payee": <string or null>, "date": <"YYYY-MM-DD" or null>, "isPayment": <true or false>}`;

export type CreatePendingResult =
  | { success: true; created: true }
  | { success: true; created: false; reason: string }
  | { success: false; error: string };

async function callGroqOnce(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
): Promise<{ ok: true; data: unknown } | { ok: false; retryable: boolean; error: string }> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Groq's json_object mode occasionally returns an empty generation
      // that fails its own schema validation (json_validate_failed) — a
      // transient hiccup, not a real problem with the input, so it's worth
      // one retry rather than surfacing an error for something a second
      // attempt would likely read fine.
      const retryable = res.status >= 500 || body.includes("json_validate_failed");
      return { ok: false, retryable, error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, retryable: false, error: "Groq returned an unexpected response shape." };
    return { ok: true, data: JSON.parse(content) };
  } catch (e) {
    return { ok: false, retryable: true, error: e instanceof Error ? e.message : "Couldn't read that." };
  }
}

async function callGroqForExtraction(
  model: string,
  systemPrompt: string,
  userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
): Promise<CreatePendingResult | { success: true; data: { amount: number | null; payee: string | null; date: string | null; isPayment: boolean } }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { success: false, error: "GROQ_API_KEY is not set." };

  let result = await callGroqOnce(apiKey, model, systemPrompt, userContent);
  if (!result.ok && result.retryable) {
    result = await callGroqOnce(apiKey, model, systemPrompt, userContent);
  }
  if (!result.ok) return { success: false, error: result.error };

  const parsed = extractedPaymentSchema.safeParse(result.data);
  if (!parsed.success) return { success: false, error: "Couldn't make sense of the response." };
  return { success: true, data: parsed.data };
}

async function savePending(
  data: { amount: number | null; payee: string | null; date: string | null; isPayment: boolean },
  notFoundReason: string,
  source: "gpay_screenshot" | "shared_text"
): Promise<CreatePendingResult> {
  if (!data.isPayment || data.amount == null) {
    return { success: true, created: false, reason: notFoundReason };
  }
  const { amount, payee, date } = data;
  const summary = payee ? `₹${amount.toLocaleString("en-IN")} to ${payee}` : `₹${amount.toLocaleString("en-IN")} payment`;

  await prisma.pendingTransaction.create({
    data: { amount, payee, summary, paymentDate: date ? new Date(date) : null, source },
  });
  revalidatePath("/");
  return { success: true, created: true };
}

/** Called from the Web Share Target route handler when a payment screenshot is shared into the app. */
export async function createPendingFromImage(imageDataUrl: string): Promise<CreatePendingResult> {
  await requireAuth();
  if (!imageDataUrl.startsWith("data:image/")) {
    return { success: false, error: "That doesn't look like a valid image." };
  }

  const result = await callGroqForExtraction(GROQ_VISION_MODEL, IMAGE_SYSTEM_PROMPT, [
    { type: "text", text: "Read this payment screenshot." },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ]);
  if (!("data" in result)) return result;
  return savePending(result.data, "Couldn't find a payment amount in that screenshot.", "gpay_screenshot");
}

/** Called from the Web Share Target route handler when a bank/UPI SMS is shared into the app as text. */
export async function createPendingFromText(text: string): Promise<CreatePendingResult> {
  await requireAuth();
  const trimmed = text.trim();
  if (!trimmed) return { success: false, error: "Nothing was shared." };

  const result = await callGroqForExtraction(GROQ_TEXT_MODEL, TEXT_SYSTEM_PROMPT, trimmed);
  if (!("data" in result)) return result;
  return savePending(result.data, "Couldn't find a payment amount in that text.", "shared_text");
}

export async function dismissPendingTransaction(id: string) {
  await requireAuth();
  try {
    await prisma.pendingTransaction.delete({ where: { id } });
  } catch (e) {
    return { success: false, error: toErrorMessage(e) };
  }
  revalidatePath("/");
  return { success: true };
}

/** Turns a pending item into a real transaction, then removes it from the pending list. */
export async function confirmPendingTransaction(pendingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const parsed = parseForm(confirmPendingSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          type: "EXPENSE",
          amount: d.amount,
          date: d.date,
          description: d.description,
          notes: d.notes ?? "Confirmed from a shared payment screenshot or SMS",
          paymentMode: d.paymentMode,
          categoryId: emptyToNull(d.categoryId),
          cardId: emptyToNull(d.cardId),
          bankAccountId: emptyToNull(d.bankAccountId),
        },
      }),
      prisma.pendingTransaction.delete({ where: { id: pendingId } }),
    ]);
  } catch (e) {
    return { status: "error", message: toErrorMessage(e) };
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/cards");
  revalidatePath("/accounts");
  revalidatePath("/reports");
  revalidatePath("/budgets");

  const categoryId = emptyToNull(d.categoryId);
  const alerts = await checkAllBudgetAlerts(categoryId, d.date);
  const suffix = alerts.length ? ` ⚠ ${alerts.map(formatBudgetAlert).join(" ⚠ ")}` : "";

  return { status: "success", message: `Transaction added.${suffix}` };
}
