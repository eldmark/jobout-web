/** FC6: el panel muestra el menú según los roles de GET /me; nada supone un solo rol. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t } from "@/lib/messages";
import DashboardView from "@/app/_components/DashboardView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "jo_session" ? { name: n, value: "acc-111" } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
import Dashboard from "@/app/dashboard/page";

const PERSONA = { first_name: "Ana", last_name: "Paz", plan: { code: "free", name: "Gratis" } };
/** Lo que devuelve GET /me; `roles` puede venir con cualquier forma. */
const ME = (roles: unknown) => ({ ...PERSONA, roles, permissions: [] });
const sp = { searchParams: Promise.resolve({}) };
const menu = () => screen.queryByRole("navigation", { name: t("dashboard.nav.label") });
const enlaces = () => within(menu()!).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DashboardView: menú por rol", () => {
  it("un candidato ve «Ver ofertas» y «Mis aplicaciones»", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["applicant"] }} />);
    expect(enlaces()).toEqual([
      [t("dashboard.nav.offers"), "/offers"],
      [t("dashboard.nav.applications"), "/applications"],
    ]);
  });
  it("candidato y administrador de empresa a la vez: conserva el menú de candidato", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["applicant", "company_admin"] }} />);
    expect(enlaces().map(([, h]) => h)).toEqual(["/offers", "/applications"]);
  });
  it("sin el rol de candidato (p. ej. solo admin de plataforma) no hay menú de candidato", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["admin"] }} />);
    expect(menu()).toBeNull();
    expect(screen.queryByRole("link", { name: t("dashboard.nav.offers") })).toBeNull();
  });
  it("sin roles conocidos no se inventa ninguno", () => {
    render(<DashboardView me={PERSONA} />);
    expect(menu()).toBeNull();
  });
});

describe("página del dashboard: los roles salen de GET /me", () => {
  const con = (me: unknown) => stubFetch((c) => (c.url.endsWith("/api/v1/me") ? jsonRes(200, me) : jsonRes(404)));
  it("con roles [applicant] muestra el menú de candidato", async () => {
    con(ME(["applicant"]));
    render(await Dashboard(sp));
    expect(enlaces().map(([, h]) => h)).toEqual(["/offers", "/applications"]);
  });
  it("roles con otra forma no rompen la página: sin menú, con el saludo", async () => {
    con(ME("applicant"));
    render(await Dashboard(sp));
    expect(menu()).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana");
  });
});
