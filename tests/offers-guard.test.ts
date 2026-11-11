/** Fase 5a, paso 11: las páginas del candidato exigen sesión; sus endpoints responden 401 JSON por sí mismos. */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { decideRoute } from "@/lib/auth/route-guard";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { AID, OID } from "./helpers/offers";

describe("/offers, /offers/[id] y /applications son privadas", () => {
  for (const p of ["/offers", "/offers/", `/offers/${OID}`, "/applications", "/applications/"]) {
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
});

describe("endpoints de ofertas y aplicaciones sin sesión llegan al handler (401 JSON, no el HTML de /sign-in)", () => {
  for (const p of ["/api/offers", `/api/offers/${OID}`, `/api/offers/${OID}/applications`, "/api/applications", `/api/applications/${AID}/withdraw`, "/api/applications/external", "/api/catalogs/states"]) {
    it(`${p}`, () => expect(decideRoute(p, false)).toEqual({ action: "allow" }));
  }
  it("prefijos parecidos siguen protegidos por el middleware", () => {
    for (const p of ["/api/offersx", "/api/applicationsx", "/offersx", "/applicationsx"]) {
      expect(decideRoute(p, false).action, p).toBe("redirect");
    }
  });
});
