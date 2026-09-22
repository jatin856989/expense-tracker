import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

/**
 * Defense-in-depth: `proxy.ts` already blocks unauthenticated page loads,
 * but Next.js Server Actions are invoked as POSTs to whatever route defines
 * them — a proxy matcher gap (or a future refactor that moves an action to
 * an excluded path) would silently drop that coverage. Every mutating
 * action calls this directly, so auth is enforced here regardless of the
 * proxy's matcher. Throws, which surfaces as a generic error to the caller.
 *
 * Kept in its own file (not shared.ts) because shared.ts is imported by
 * client components too (for the ActionState type and initialActionState) —
 * next/headers can only ever be imported by server-only code.
 */
export async function requireAuth() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Server misconfigured: AUTH_SECRET is not set.");

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token, secret);
  if (!valid) throw new Error("Not authenticated.");
}
