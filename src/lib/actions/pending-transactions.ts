"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkBudgetAlert, formatBudgetAlert } from "@/lib/budget-alerts";
import { extractedPaymentSchema, confirmPendingSchema } from "@/lib/validations-pending";
import { ActionState, emptyToNull, parseForm, toErrorMessage } from "./shared";
import { requireAuth } from "./require-auth";

// Same deprecation-prone Groq vision model as the portfolio screenshot
// importer — kept as a separate env override in case the two ever need to
// diverge, but defaults to the same model.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

const SYSTEM_PROMPT = `You read a screenshot of a UPI payment confirmation (Google Pay, PhonePe, Paytm, or similar). Respond with ONLY a JSON object, no other text.

Extract:
- "amount": the amount paid, as a plain number with no currency symbol, or null if not clearly visible
- "payee": the name of the person or merchant the payment was made to, or null if not visible
- "date": the payment date in YYYY-MM-DD format if visible, else null (if only a time is shown with no date, assume today and still return null — do not guess a date)
- "isPaymentScreenshot": true if this image is genuinely a payment/transaction confirmation screen, false if it's clearly something else (a random photo, a different kind of screenshot, etc.)

Respond with exactly this shape:
{"amount": <number or null>, "payee": <string or null>, "date": <"YYYY-MM-DD" or null>, "isPaymentScreenshot": <true or false>}`;

export type CreatePendingResult =
  | { success: true; created: true }
  | { success: true; created: false; reason: string }
  | { success: false; error: string };

/** Called from the Web Share Target route handler when a payment screenshot is shared into the app. */
export async function createPendingFromImage(imageDataUrl: string): Promise<CreatePendingResult> {
  await requireAuth();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { success: false, error: "GROQ_API_KEY is not set." };
  if (!imageDataUrl.startsWith("data:image/")) {
    return { success: false, error: "That doesn't look like a valid image." };
  }

  let raw: unknown;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Read this payment screenshot." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `Groq API error (${res.status}): ${body.slice(0, 300)}` };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { success: false, error: "Groq returned an unexpected response shape." };
    raw = JSON.parse(content);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't read the screenshot." };
  }

  const parsed = extractedPaymentSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.isPaymentScreenshot || parsed.data.amount == null) {
    return { success: true, created: false, reason: "Couldn't find a payment amount in that screenshot." };
  }

  const { amount, payee, date } = parsed.data;
  const summary = payee ? `₹${amount.toLocaleString("en-IN")} to ${payee}` : `₹${amount.toLocaleString("en-IN")} payment`;

  await prisma.pendingTransaction.create({
    data: {
      amount,
      payee,
      summary,
      paymentDate: date ? new Date(date) : null,
    },
  });

  revalidatePath("/");
  return { success: true, created: true };
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
          notes: d.notes ?? "Confirmed from a shared GPay screenshot",
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
  let suffix = "";
  if (categoryId) {
    const alert = await checkBudgetAlert(categoryId, d.date);
    if (alert) suffix = ` ⚠ ${formatBudgetAlert(alert)}`;
  }

  return { status: "success", message: `Transaction added.${suffix}` };
}
