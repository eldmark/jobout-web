/** F6: /dashboard muestra el nombre de GET /me. Más estados de error y logout. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t } from "@/lib/messages";
import { goTo } from "@/lib/navigate";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const jar: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (jar[n] ? { name: n, value: jar[n] } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import Dashboard from "@/app/dashboard/page";

const ME = { id: "u1", first_name: "Ana", last_name: "Paz", status: "active", email: "ana@mail.com", plan: { code: "free", name: "Gratis" } };
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });

beforeEach(() => {
  vi.stubEnv("API_URL_INTERNA", "http://core-api:8080");
  for (const k of Object.keys(jar)) delete jar[k];
  jar.jo_session = "acc-111";
  jar.jo_refresh = "ref-222";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("/dashboard", () => {
  it("F6: muestra el nombre y el plan que devolvió GET /me, pidiéndolo con Bearer", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, ME));
    render(await Dashboard(sp()));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana");
    expect(screen.getByText(/Gratis/)).toHaveTextContent(`${t("dashboard.plan")} Gratis`);
    expect(llamadas[0].url).toBe("http://core-api:8080/api/v1/me");
    expect(llamadas[0].headers.get("authorization")).toBe("Bearer acc-111");
  });
  it("401: manda al refresco transparente", async () => {
    stubFetch(() => jsonRes(401, { error: "token_invalido" }));
    await expect(Dashboard(sp())).rejects.toThrow("REDIRECT:/api/auth/refresh");
  });
  it("401 justo después de refrescar: no hay bucle, cierra la sesión", async () => {
    stubFetch(() => jsonRes(401));
    await expect(Dashboard(sp({ refreshed: "1" }))).rejects.toThrow("REDIRECT:/api/auth/refresh?fail=1");
  });
  it("sin cookie de acceso pero con refresh: refresca directamente, sin llamar a /me", async () => {
    delete jar.jo_session;
    const { fn } = stubFetch(() => jsonRes(200, ME));
    await expect(Dashboard(sp())).rejects.toThrow("REDIRECT:/api/auth/refresh");
    expect(fn).not.toHaveBeenCalled();
  });
  it("error del backend: estado de error en español, sin dar por perdida la sesión", async () => {
    stubFetch(() => jsonRes(500));
    render(await Dashboard(sp()));
    expect(screen.getByRole("alert")).toHaveTextContent(t("dashboard.error"));
  });
  it("backend caído: también estado de error", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(await Dashboard(sp()));
    expect(screen.getByRole("alert")).toHaveTextContent(t("dashboard.error"));
  });
  it("incluye «Cerrar sesión» y «Borrar mi cuenta»", async () => {
    stubFetch(() => jsonRes(200, ME));
    render(await Dashboard(sp()));
    expect(screen.getByRole("button", { name: t("dashboard.logout") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("account.delete.open") })).toBeInTheDocument();
  });
  it("«Cerrar sesión» hace POST /api/auth/logout y va a /sign-in", async () => {
    const { llamadas } = stubFetch((c) => (c.url === "/api/auth/logout" ? jsonRes(204) : jsonRes(200, ME)));
    render(await Dashboard(sp()));
    llamadas.length = 0;
    fireEvent.click(screen.getByRole("button", { name: t("dashboard.logout") }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"));
    expect(llamadas[0]).toMatchObject({ url: "/api/auth/logout", method: "POST" });
  });
});
