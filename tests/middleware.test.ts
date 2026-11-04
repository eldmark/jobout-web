import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

describe("middleware", () => {
  it("redirige /dashboard sin cookie a /sign-in", () => {
    const res = middleware(new NextRequest("http://localhost/dashboard"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });
  it("deja pasar /dashboard con cookie de sesión", () => {
    const req = new NextRequest("http://localhost/dashboard", {
      headers: { cookie: `${SESSION_COOKIE}=abc` },
    });
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
  it("deja pasar /health sin cookie", () => {
    expect(middleware(new NextRequest("http://localhost/health")).headers.get("location")).toBeNull();
  });
  it("el matcher excluye estáticos de Next", () => {
    expect(config.matcher.join()).toMatch(/_next\/static/);
  });
});
