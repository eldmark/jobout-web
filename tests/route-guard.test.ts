/** F1 y F2: protección de rutas como función pura. */
import { describe, it, expect } from "vitest";
import { decideRoute } from "@/lib/auth/route-guard";

describe("F1 rutas privadas sin sesión", () => {
  for (const p of ["/dashboard", "/dashboard/perfil", "/interview/123", "/settings"]) {
    it(`${p} redirige a /sign-in`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "redirect", to: "/sign-in" });
    });
  }
  it("con sesión se permite /dashboard", () => {
    expect(decideRoute("/dashboard", true)).toEqual({ action: "allow" });
  });
});

describe("F2 rutas públicas sin sesión", () => {
  for (const p of ["/", "/sign-in", "/sign-up", "/health", "/sign-in/", "/_next/static/a.js", "/favicon.ico"]) {
    it(`${p} se permite`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "allow" });
    });
  }
  // Demo de la presentación: la página y sus GIF se ven sin iniciar sesión.
  for (const p of ["/demo", "/demo/", "/demo/candidato-cv-entrevista.gif"]) {
    it(`${p} se permite (demo)`, () => {
      expect(decideRoute(p, false)).toEqual({ action: "allow" });
    });
  }
  it("un prefijo parecido a /demo no cuenta como público", () => {
    expect(decideRoute("/demostracion", false).action).toBe("redirect");
    expect(decideRoute("/dashboard/demo", false).action).toBe("redirect");
  });

  it("un prefijo parecido no cuenta como público", () => {
    expect(decideRoute("/sign-industry", false).action).toBe("redirect");
    expect(decideRoute("/health-private", false).action).toBe("redirect");
    expect(decideRoute("/dashboard/sign-in", false).action).toBe("redirect");
  });
});
