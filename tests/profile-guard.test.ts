/** F1: las pantallas de perfil exigen sesión; los endpoints propios responden 401 por sí mismos. */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { decideRoute } from "@/lib/auth/route-guard";

describe("F1 /profile y /profile/cv", () => {
  for (const p of ["/profile", "/profile/cv", "/profile/cv/"]) {
    it(`${p} sin sesión redirige a /sign-in`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "redirect", to: "/sign-in" });
      const res = middleware(new NextRequest(`http://localhost${p}`));
      expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
    });
    it(`${p} con sesión pasa`, () => {
      expect(decideRoute(p, true)).toEqual({ action: "allow" });
    });
  }
  it("un prefijo parecido no cuenta", () => {
    expect(decideRoute("/profile-x", false).action).toBe("redirect");
  });
});

describe("endpoints de CV sin sesión llegan al handler (que responde 401 JSON, no HTML)", () => {
  for (const p of ["/api/cvs", "/api/cvs/abc/file", "/api/profile", "/api/catalogs/skills"]) {
    it(`${p}`, () => expect(decideRoute(p, false)).toEqual({ action: "allow" }));
  }
  it("el resto de /api sigue protegido por el middleware", () => {
    expect(decideRoute("/api/account", false).action).toBe("redirect");
    expect(decideRoute("/api/cvsx", false).action).toBe("redirect");
  });
});
