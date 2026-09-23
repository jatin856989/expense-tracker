"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "./require-auth";
import { voiceParseResultSchema, type VoiceParseResult } from "@/lib/validations-voice";
import { PAYMENT_MODE_LABELS } from "@/lib/constants";
import { checkBudgetAlert, formatBudgetAlert } from "@/lib/budget-alerts";

export type VoiceCommandResult =
  | { success: true; summary: string; undo: { entity: "transaction" | "loan"; id: string } }
  | { success: false; error: string; transcript: string };

// llama-3.1-8b-instant was deprecated by Groq on 2026-08-16; this is their
// official replacement (also faster: ~1000 tokens/sec vs ~560).
const GROQ_MODEL = "openai/gpt-oss-20b";

/** Picks the closest existing name by case-insensitive exact/substring match. Returns null if nothing close enough. */
function matchName(candidate: string | null | undefined, options: { id: string; name: string }[]): string | null {
  if (!candidate) return null;
  const needle = candidate.trim().toLowerCase();
  if (!needle) return null;

  const exact = options.find((o) => o.name.toLowerCase() === needle);
  if (exact) return exact.id;

  const substring = options.find(
    (o) => o.name.toLowerCase().includes(needle) || needle.includes(o.name.toLowerCase())
  );
  return substring?.id ?? null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildSystemPrompt(context: {
  today: string;
  expenseCategories: string[];
  incomeCategories: string[];
  cards: string[];
  accounts: string[];
}) {
  return `You turn a single spoken sentence from a personal finance app into structured JSON. Respond with ONLY a JSON object, no other text.

Today's date is ${context.today} (YYYY-MM-DD). Resolve relative dates like "yesterday" or "last Monday" against it. If no date is mentioned, use today.

Decide the "intent" field:
- "transaction": the person is logging an expense, income, or a transfer between their own accounts.
- "loan": the person lent money to someone, or borrowed money from someone.
- "unknown": you cannot confidently extract an intent or a required amount — explain briefly in "reason".

For intent "transaction", return exactly:
{
  "intent": "transaction",
  "type": "EXPENSE" | "INCOME" | "TRANSFER",
  "amount": <number, no currency symbol>,
  "description": <short string, e.g. "Lunch with team">,
  "categoryName": <pick the single closest name from this list, or null if none fit — Expense categories: ${context.expenseCategories.join(", ") || "(none)"} — Income categories: ${context.incomeCategories.join(", ") || "(none)"}>,
  "paymentMode": "CASH" | "ONLINE" | "CARD" | "UPI" | "BANK_TRANSFER" | "OTHER",
  "cardName": <closest match from this list if a card was mentioned, else null — Cards: ${context.cards.join(", ") || "(none)"}>,
  "accountName": <closest match from this list if an account was mentioned, else null — Accounts: ${context.accounts.join(", ") || "(none)"}>,
  "transferToAccountName": <only for TRANSFER: the destination account name from the same list, else null>,
  "date": "YYYY-MM-DD"
}

For intent "loan", return exactly:
{
  "intent": "loan",
  "type": "LENT" | "BORROWED",
  "personName": <the other person's name>,
  "amount": <number>,
  "reason": <short reason if mentioned, else null>,
  "date": "YYYY-MM-DD"
}

For intent "unknown", return exactly:
{ "intent": "unknown", "reason": <short explanation> }

Rules: amount is required for "transaction" and "loan" — if you can't find a clear number, use "unknown" instead. Never invent a category, card, or account name that isn't in the lists above — use null if nothing fits well. Output raw JSON only.`;
}

async function callGroq(transcript: string, systemPrompt: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — see VOICE_SETUP.md.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Groq returned an unexpected response shape.");

  return JSON.parse(content);
}

export async function parseAndCreateVoiceCommand(transcript: string): Promise<VoiceCommandResult> {
  await requireAuth();

  const trimmed = transcript.trim();
  if (!trimmed) return { success: false, error: "Didn't catch anything — try again.", transcript };

  const [categories, cards, accounts] = await Promise.all([
    prisma.category.findMany({ where: { kind: { in: ["EXPENSE", "INCOME"] } } }),
    prisma.card.findMany({ where: { isActive: true } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
  ]);

  const systemPrompt = buildSystemPrompt({
    today: todayISO(),
    expenseCategories: categories.filter((c) => c.kind === "EXPENSE").map((c) => c.name),
    incomeCategories: categories.filter((c) => c.kind === "INCOME").map((c) => c.name),
    cards: cards.map((c) => c.name),
    accounts: accounts.map((a) => a.name),
  });

  let raw: unknown;
  try {
    raw = await callGroq(trimmed, systemPrompt);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Voice parsing failed.", transcript };
  }

  const parsed = voiceParseResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Couldn't make sense of that — try rephrasing.", transcript };
  }

  const result: VoiceParseResult = parsed.data;

  if (result.intent === "unknown") {
    return { success: false, error: result.reason || "Couldn't figure out what to do with that.", transcript };
  }

  if (result.intent === "transaction") {
    const categoryId = matchName(
      result.categoryName,
      categories.filter((c) => c.kind === result.type).map((c) => ({ id: c.id, name: c.name }))
    );
    const cardId = matchName(result.cardName, cards.map((c) => ({ id: c.id, name: c.name })));
    const bankAccountId = matchName(result.accountName, accounts.map((a) => ({ id: a.id, name: a.name })));
    const transferToAccountId =
      result.type === "TRANSFER" ? matchName(result.transferToAccountName, accounts.map((a) => ({ id: a.id, name: a.name }))) : null;

    if (result.type === "TRANSFER" && (!bankAccountId || !transferToAccountId || bankAccountId === transferToAccountId)) {
      return {
        success: false,
        error: "Heard a transfer, but couldn't match two different accounts — try naming both accounts clearly.",
        transcript,
      };
    }

    const transaction = await prisma.transaction.create({
      data: {
        type: result.type,
        amount: result.amount,
        date: new Date(result.date),
        description: result.description,
        notes: `Added by voice: "${trimmed}"`,
        paymentMode: result.paymentMode,
        categoryId,
        cardId,
        bankAccountId,
        transferToAccountId,
      },
    });

    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/cards");
    revalidatePath("/accounts");
    revalidatePath("/reports");
    revalidatePath("/budgets");

    const verb = result.type === "EXPENSE" ? "Expense" : result.type === "INCOME" ? "Income" : "Transfer";
    let budgetSuffix = "";
    if (result.type === "EXPENSE" && categoryId) {
      const alert = await checkBudgetAlert(categoryId, transaction.date);
      if (alert) budgetSuffix = ` ⚠ ${formatBudgetAlert(alert)}`;
    }
    return {
      success: true,
      summary: `${verb} added: ₹${result.amount.toLocaleString("en-IN")} — ${result.description} (${PAYMENT_MODE_LABELS[result.paymentMode]})${budgetSuffix}`,
      undo: { entity: "transaction", id: transaction.id },
    };
  }

  // intent === "loan"
  const loan = await prisma.loan.create({
    data: {
      type: result.type,
      personName: result.personName,
      amount: result.amount,
      date: new Date(result.date),
      reason: result.reason,
      notes: `Added by voice: "${trimmed}"`,
    },
  });

  revalidatePath("/");
  revalidatePath("/loans");
  revalidatePath("/reports");

  const verb = result.type === "LENT" ? "Lent to" : "Borrowed from";
  return {
    success: true,
    summary: `${verb} ${result.personName}: ₹${result.amount.toLocaleString("en-IN")}`,
    undo: { entity: "loan", id: loan.id },
  };
}

export async function undoVoiceEntity(entity: "transaction" | "loan", id: string) {
  await requireAuth();
  if (entity === "transaction") {
    await prisma.transaction.delete({ where: { id } }).catch(() => null);
    revalidatePath("/transactions");
  } else {
    await prisma.loan.delete({ where: { id } }).catch(() => null);
    revalidatePath("/loans");
  }
  revalidatePath("/");
  revalidatePath("/reports");
}
