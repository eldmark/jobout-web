/** Fase 5a, paso 12: las páginas del reclutador y de administración exigen sesión; sus endpoints responden 401 JSON. */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { decideRoute } from "@/lib/auth/route-guard";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { CID, OFF, PAP } from "./helpers/company";

describe("páginas del lado empresa y de administración: privadas", () => {
  for (const p of ["/company", "/company/offers", "/company/offers/new", `/company/offers/${OFF}`, `/company/offers/${OFF}/applications`, "/admin/companies"]) {
    it(`${p} sin sesión redirige a /sign-in; con sesión pasa`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "redirect", to: "/sign-in" });
      expect(new URL(middleware(new NextRequest(`http://localhost${p}`)).headers.get("location")!).pathname).toBe("/sign-in");
      expect(decideRoute(p, true)).toEqual({ action: "allow" });
      expect(middleware(new NextRequest(`http://localhost${p}`, { headers: { cookie: `${SESSION_COOKIE}=abc` } })).headers.get("location")).toBeNull();
    });
  }
});

describe("endpoints sin sesión llegan al handler (401 JSON, no el HTML de /sign-in)", () => {
  for (const p of ["/api/company", "/api/company/offers", `/api/company/offers/${OFF}/applications`, `/api/company/applications/${PAP}/favorite`, "/api/invitations/accept", "/api/admin/companies", `/api/admin/companies/${CID}/verify`]) {
    it(`${p}`, () => expect(decideRoute(p, false)).toEqual({ action: "allow" }));
  }
  it("prefijos parecidos siguen protegidos", () => {
    for (const p of ["/api/companyx", "/api/adminx", "/api/invitationsx", "/api/companies"]) expect(decideRoute(p, false).action, p).toBe("redirect");
  });
});
