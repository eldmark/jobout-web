import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import { decideRoute } from "@/lib/auth/route-guard";

export function middleware(request: NextRequest) {
  // El access dura 15 min; con solo el refresh, la página lo renueva (/api/auth/refresh).
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value || request.cookies.get(REFRESH_COOKIE)?.value,
  );
  const decision = decideRoute(request.nextUrl.pathname, hasSession);
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
