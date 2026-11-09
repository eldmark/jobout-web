/** F1: /interviews* exige sesión; los endpoints propios responden 401 JSON (no el HTML de /sign-in). */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { decideRoute } from "@/lib/auth/route-guard";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

const ID = "22222222-2222-4222-8222-222222222222";

describe("F1 /interviews y /interviews/[id]", () => {
  for (const p of ["/interviews", "/interviews/", `/interviews/${ID}`, "/interviews/progress"]) {
    it(`${p} sin sesión redirige a /sign-in (función y middleware)`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "redirect", to: "/sign-in" });
      const res = middleware(new NextRequest(`http://localhost${p}`));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
    });
    it(`${p} con sesión pasa`, () => {
      expect(decideRoute(p, true)).toEqual({ action: "allow" });
      const res = middleware(new NextRequest(`http://localhost${p}`, { headers: { cookie: `${SESSION_COOKIE}=abc` } }));
      expect(res.headers.get("location")).toBeNull();
    });
  }
  it("un prefijo parecido no cuenta como público", () => {
    expect(decideRoute("/interviewsx", false).action).toBe("redirect");
  });
});

describe("endpoints de entrevistas sin sesión llegan al handler (401 JSON)", () => {
  for (const p of ["/api/recruiters", "/api/levels", "/api/progress", "/api/interviews", `/api/interviews/${ID}/turns`]) {
    it(`${p}`, () => expect(decideRoute(p, false)).toEqual({ action: "allow" }));
  }
  it("prefijos parecidos siguen protegidos", () => {
    expect(decideRoute("/api/interviewsx", false).action).toBe("redirect");
    expect(decideRoute("/api/levelsx", false).action).toBe("redirect");
  });
});
