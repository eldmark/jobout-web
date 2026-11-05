/** F12: «Completa tu perfil» si no hay CV ni skills; desaparece cuando hay. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t } from "@/lib/messages";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "jo_session" ? { name: n, value: "acc-111" } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
import Dashboard from "@/app/dashboard/page";

const ME = { first_name: "Ana", last_name: "Paz", plan: { code: "free", name: "Gratis" } };
const VACIO = { description: null, phone: null, skills: [], languages: [], experiences: [] };
const CV = { id: "x", version: 1, is_primary: true, original_filename: "a.pdf", size_bytes: 1, created_at: "x" };
const sp = { searchParams: Promise.resolve({}) };

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function con(cvs: unknown, perfil: unknown) {
  return stubFetch((c) => {
    if (c.url.endsWith("/api/v1/me")) return jsonRes(200, ME);
    if (c.url.endsWith("/api/v1/cvs")) return typeof cvs === "number" ? jsonRes(cvs) : jsonRes(200, cvs);
    if (c.url.endsWith("/api/v1/profile")) return typeof perfil === "number" ? jsonRes(perfil) : jsonRes(200, perfil);
    return jsonRes(404);
  });
}

describe("F12 «Completa tu perfil»", () => {
  it("aparece sin CV ni skills, con enlace a /profile/cv y Bearer", async () => {
    const { llamadas } = con([], VACIO);
    render(await Dashboard(sp));
    expect(screen.getByRole("link", { name: t("dashboard.completeProfile") })).toHaveAttribute("href", "/profile/cv");
    expect(llamadas[0].url).toMatch(/\/me$/);
    expect(llamadas.find((c) => c.url.endsWith("/cvs"))!.headers.get("authorization")).toBe("Bearer acc-111");
  });
  it("desaparece si hay un CV", async () => {
    con([CV], VACIO);
    render(await Dashboard(sp));
    expect(screen.queryByRole("link", { name: t("dashboard.completeProfile") })).toBeNull();
  });
  it("desaparece si hay skills", async () => {
    con([], { ...VACIO, skills: [{ skill_id: "s", level: null }] });
    render(await Dashboard(sp));
    expect(screen.queryByRole("link", { name: t("dashboard.completeProfile") })).toBeNull();
  });
  it("si no se pudo saber (error), no molesta", async () => {
    con(500, VACIO);
    render(await Dashboard(sp));
    expect(screen.queryByRole("link", { name: t("dashboard.completeProfile") })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana");
  });
});
