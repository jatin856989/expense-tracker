"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import type { ActionState } from "./shared";

// A constant delay on every failed attempt — cheap, and it flattens the
// timing difference between "wrong username" and "wrong password" so a
// caller can't use response time to enumerate which one was wrong.
const FAILED_LOGIN_DELAY_MS = 600;

// Real lockout on top of the flat delay above — the delay alone only slows
// a script down to ~1 attempt/second, which still grinds through a
// weak-to-moderate password in hours. Backed by the database (not an
// in-memory counter) so it survives serverless cold starts between
// requests. Keyed by IP, not username, since there's only one valid
// username anyway.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * AUTH_PASSWORD_HASH is stored base64-encoded, not as a raw bcrypt hash.
 * Next.js's env loader (@next/env) does $VAR-style interpolation on .env
 * values, and a bcrypt hash is full of `$`-delimited segments (e.g.
 * `$2b$10$...`) that look exactly like variable references — it silently
 * stripped the `$2b$10$<salt>` prefix in testing. Base64 has no `$`
 * characters, so it round-trips intact regardless of the loader's
 * interpolation rules. See AUTH_SETUP.md for the matching hash command.
 */
function decodeHash(base64Hash: string): string {
  return Buffer.from(base64Hash, "base64").toString("utf8");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedHashB64 = process.env.AUTH_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;

  if (!expectedUsername || !expectedHashB64 || !secret) {
    return { status: "error", message: "Server misconfigured: AUTH_USERNAME, AUTH_PASSWORD_HASH or AUTH_SECRET is not set." };
  }

  if (!username || !password) {
    return { status: "error", message: "Enter both a username and password." };
  }

  const ip = await getClientIp();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

  // Opportunistic cleanup — keeps the table small for a single-user app
  // without needing a separate cron job just to prune it.
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });

  const recentFailures = await prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: windowStart } },
  });
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    return {
      status: "error",
      message: `Too many failed attempts. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.`,
    };
  }

  const usernameOk = username === expectedUsername;
  // Always run bcrypt.compare (even for a wrong username, against the real
  // hash) so failed attempts take a consistent amount of time either way.
  const passwordOk = await bcrypt.compare(password, decodeHash(expectedHashB64));

  if (!usernameOk || !passwordOk) {
    await prisma.loginAttempt.create({ data: { ip, success: false } });
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    const remaining = MAX_FAILED_ATTEMPTS - recentFailures - 1;
    const message =
      remaining <= 0
        ? `Invalid username or password. Too many failed attempts — locked for ${LOCKOUT_WINDOW_MINUTES} minutes.`
        : `Invalid username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} left before a temporary lockout.`;
    return { status: "error", message };
  }

  await prisma.loginAttempt.deleteMany({ where: { ip, success: false } });

  const token = await createSessionToken(username, secret);
  (await cookies()).set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
