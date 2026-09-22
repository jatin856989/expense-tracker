/**
 * Signed session tokens for the single-user login wall.
 *
 * Deliberately not a JWT library — this is a small, self-contained HMAC
 * signature over a JSON payload, using the Web Crypto API so the exact same
 * code works in `proxy.ts` (Next.js 16 always runs proxy on the Node.js
 * runtime, but Web Crypto works there too) and in Server Actions.
 *
 * The signing key (AUTH_SECRET) never touches the token itself — only a
 * signature derived from it does — so a valid token proves the holder went
 * through login, without embedding the secret anywhere client-visible.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  // Explicit ArrayBuffer (not the wider ArrayBufferLike) so this satisfies
  // crypto.subtle's BufferSource type under strict TS + recent lib.dom.
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

type SessionPayload = { u: string; exp: number };

export async function createSessionToken(username: string, secret: string): Promise<string> {
  const payload: SessionPayload = { u: username, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  try {
    const key = await getHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigB64), encoder.encode(payloadB64));
    if (!valid) return false;

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as SessionPayload;
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
