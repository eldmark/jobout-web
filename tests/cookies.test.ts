/** F5: cookies de sesión HttpOnly + Secure + SameSite=Lax; nunca almacenamiento web. */
import { describe, it, expect } from "vitest";
import { serializeSessionCookie, clearSessionCookie, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { leer, listar } from "./helpers/fuentes";

describe("F5 cookies de sesión", () => {
  it("lleva HttpOnly, Secure, SameSite=Lax y Path=/", () => {
    const c = serializeSessionCookie(SESSION_COOKIE, "jwt", { maxAgeSeconds: 900 });
    expect(c).toMatch(/^jo_session=jwt;/);
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=900"]) {
      expect(c).toContain(attr);
    }
  });
  it("codifica el valor para que no rompa la cabecera", () => {
    expect(serializeSessionCookie(REFRESH_COOKIE, "a;b c", { maxAgeSeconds: 1 })).toContain("a%3Bb%20c");
  });
  it("clearSessionCookie expira la cookie con los mismos atributos", () => {
    const c = clearSessionCookie(SESSION_COOKIE);
    expect(c).toContain("Max-Age=0");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
  });
  it("rechaza nombres inválidos", () => {
    expect(() => serializeSessionCookie("mal nombre", "x", { maxAgeSeconds: 1 })).toThrow();
  });
  it("ningún archivo de lib/, app/ ni middleware usa localStorage/sessionStorage", () => {
    const archivos = [...listar("lib"), ...listar("app"), "middleware.ts"];
    for (const f of archivos) {
      expect(leer(f), f).not.toMatch(/\b(localStorage|sessionStorage)\b/);
    }
  });
});
