import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (and the exported
// function to `proxy`) — this always runs on the Node.js runtime now,
// which is why the same Web-Crypto-based session verification code in
// src/lib/session.ts works identically here and inside Server Actions.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.AUTH_SECRET;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = secret ? await verifySessionToken(token, secret) : false;

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Runs on every request except static assets and Next's own internals.
// Deliberately broad — Server Actions are POSTs to the same route as the
// page that defines them, so a narrow matcher risks silently letting an
// action through unauthenticated. (Each action also checks auth itself;
// see requireAuth() in src/lib/actions/shared.ts.)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
