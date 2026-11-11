/** Panel visual: piezas con color, valores reales vs. de ejemplo, buscador de ofertas y paneles de empresa y admin. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import DashboardView from "@/app/_components/DashboardView";
import type { CandidateData } from "@/lib/dashboard/data";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "jo_session" ? { name: n, value: "acc-111" } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
import Dashboard from "@/app/dashboard/page";

const NOW = "2026-11-11T15:00:00Z";
const PERSONA = { first_name: "Ana", last_name: "Paz", plan: { code: "free", name: "Gratis" } };
const pt = (completed_at: string, score: number) => ({ session_id: completed_at, completed_at, level: "Básico", recruiter: "R", score });
const BASE: CandidateData = { points: [], applications: 0, hasCv: false, hasSkills: false, professions: [], contractTypes: [] };
const candidato = (c: Partial<CandidateData> = {}, roles: string[] = ["applicant"]) =>
  render(<DashboardView me={{ ...PERSONA, roles }} candidate={{ ...BASE, ...c }} nowIso={NOW} />);
const tile = (name: string) => screen.getByRole("group", { name });

beforeEach(() => vi.stubEnv("API_URL_INTERNA", "http://core-api:8080"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("panel de la persona candidata: cuenta nueva (valores de ejemplo)", () => {
  it("las piezas de práctica llevan la etiqueta «Ejemplo» con un aria-label que dice que son ilustrativas", () => {
    candidato();
    for (const nombre of [t("dashboard.streak.title"), t("dashboard.stats.average"), t("dashboard.stats.best"), t("dashboard.stats.practices")]) {
      const nota = within(tile(nombre)).getByRole("note");
      expect(nota).toHaveTextContent(t("dashboard.sample.chip"));
      expect(nota).toHaveAttribute("aria-label", t("dashboard.sample.aria"));
    }
    expect(screen.getByText(t("dashboard.sample.note"))).toBeInTheDocument();
  });
  it("lo que es real (aplicaciones, primeros pasos) nunca lleva la etiqueta", () => {
    candidato();
    expect(within(tile(t("dashboard.stats.applications"))).queryByRole("note")).toBeNull();
    expect(within(tile(t("dashboard.completion.title"))).queryByRole("note")).toBeNull();
  });
});

describe("panel de la persona candidata: con datos reales", () => {
  const puntos = [pt("2026-11-09T10:00:00Z", 60), pt("2026-11-10T10:00:00Z", 80), pt("2026-11-11T10:00:00Z", 100)];
  it("pinta el promedio, el mejor puntaje, las prácticas y la racha calculados, sin etiqueta de ejemplo", () => {
    candidato({ points: puntos, applications: 2, hasCv: true });
    expect(tile(t("dashboard.stats.average"))).toHaveTextContent("80");
    expect(tile(t("dashboard.stats.best"))).toHaveTextContent("100");
    expect(tile(t("dashboard.stats.practices"))).toHaveTextContent("3");
    expect(tile(t("dashboard.streak.title"))).toHaveTextContent(`3 ${t("dashboard.streak.unit")}`);
    expect(tile(t("dashboard.stats.applications"))).toHaveTextContent("2");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText(t("dashboard.sample.note"))).toBeNull();
  });
  it("la semana tiene siete días con su texto para lectores de pantalla", () => {
    candidato({ points: puntos });
    const dias = within(screen.getByRole("list", { name: t("dashboard.streak.week") })).getAllByRole("listitem");
    expect(dias).toHaveLength(7);
    expect(dias[6]).toHaveTextContent(tf("dashboard.streak.dayDone", { day: "miércoles" }));
    expect(dias[0]).toHaveTextContent(t("dashboard.streak.dayMissed").replace("{day}: ", "").trim());
  });
  it("el avance cuenta los pasos hechos y apunta al siguiente", () => {
    candidato({ points: puntos, applications: 0, hasCv: true, hasSkills: true });
    const pasos = tile(t("dashboard.completion.title"));
    expect(pasos).toHaveTextContent(tf("dashboard.completion.steps", { done: 3, total: 4 }));
    expect(within(pasos).getByRole("link", { name: t("dashboard.completion.application") })).toHaveAttribute("href", "/offers");
  });
  it("si no se pudo leer el progreso no se pintan piezas de práctica ni se inventan", () => {
    candidato({ points: null, applications: null, hasCv: null, hasSkills: null });
    expect(screen.queryByRole("group", { name: t("dashboard.stats.average") })).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("group", { name: t("dashboard.completion.title") })).toBeNull();
  });
  it("los gráficos y la llama son decorativos (aria-hidden)", () => {
    const { container } = candidato({ points: puntos });
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs.length).toBeGreaterThan(3);
    for (const svg of svgs) expect(svg.closest("[aria-hidden='true']") ?? svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("buscador de ofertas", () => {
  const CATALOGO = { professions: [{ id: "p-1", code: "c", name: "Diseñadora gráfica" }, { id: "p-2", code: "d", name: "Contador" }], contractTypes: [{ id: "k-1", code: "f", name: "Tiempo completo" }] };
  it("elige la profesión sin importar tildes ni mayúsculas y va a /offers con profession_id", () => {
    candidato(CATALOGO);
    fireEvent.change(screen.getByRole("combobox", { name: t("dashboard.search.label") }), { target: { value: "disenadora GRAFICA" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(goTo).toHaveBeenCalledWith("/offers?profession_id=p-1");
  });
  it("sin coincidencia avisa y no navega; vacío va a /offers", () => {
    candidato(CATALOGO);
    const campo = screen.getByRole("combobox", { name: t("dashboard.search.label") });
    fireEvent.change(campo, { target: { value: "astronauta" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(t("dashboard.search.noMatch"));
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(goTo).toHaveBeenCalledWith("/offers");
  });
  it("los filtros rápidos usan solo lo que /offers entiende por URL", () => {
    candidato(CATALOGO);
    const chips = within(screen.getByRole("list", { name: t("dashboard.search.quick") }));
    expect(chips.getByRole("link", { name: t("dashboard.search.match") })).toHaveAttribute("href", "/offers?sort=match");
    expect(chips.getByRole("link", { name: t("dashboard.search.recent") })).toHaveAttribute("href", "/offers");
    expect(chips.getByRole("link", { name: "Tiempo completo" })).toHaveAttribute("href", "/offers?contract_type_id=k-1");
  });
});

describe("paneles de empresa y administración", () => {
  const EMPRESA = { offersTotal: 5, offersPublished: 3, received: 12, partial: false, verified: true, membership: "active" as const };
  it("una persona reclutadora ve sus cifras reales y ningún bloque de candidata", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["recruiter"] }} company={EMPRESA} candidate={BASE} nowIso={NOW} />);
    expect(tile(t("dashboard.company.published"))).toHaveTextContent("3");
    expect(tile(t("dashboard.company.received"))).toHaveTextContent("12");
    expect(tile(t("dashboard.company.verification"))).toHaveTextContent(t("dashboard.company.verified"));
    expect(tile(t("dashboard.company.verification"))).toHaveTextContent(t("dashboard.company.membershipActive"));
    expect(screen.getByRole("link", { name: t("dashboard.company.cta") })).toHaveAttribute("href", "/company/offers");
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("heading", { name: t("dashboard.stats.title") })).toBeNull();
    expect(screen.queryByRole("link", { name: t("dashboard.practice") })).toBeNull();
    expect(screen.queryByRole("navigation", { name: t("dashboard.shortcuts.label") })).toBeNull();
  });
  it("empresa sin verificar: lo dice y no inventa cifras que no se leyeron", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["company_admin"] }} company={{ ...EMPRESA, verified: false, partial: true }} nowIso={NOW} />);
    expect(tile(t("dashboard.company.verification"))).toHaveTextContent(t("dashboard.company.unverified"));
    expect(tile(t("dashboard.company.published"))).toHaveTextContent("3+");
  });
  it("sin datos de empresa no se pinta ninguna pieza", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["recruiter"] }} company={null} nowIso={NOW} />);
    expect(screen.queryByRole("group")).toBeNull();
  });
  it("administración: empresas por verificar", () => {
    render(<DashboardView me={{ ...PERSONA, roles: ["admin"] }} admin={{ pending: 4, partial: false }} nowIso={NOW} />);
    expect(tile(t("dashboard.admin.pending"))).toHaveTextContent("4");
    expect(screen.getByRole("link", { name: t("dashboard.admin.cta") })).toHaveAttribute("href", "/admin/companies");
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("página: lee solo lo que su rol necesita", () => {
  const sp = { searchParams: Promise.resolve({}) };
  const ruta = (roles: string[]) =>
    stubFetch((c) => {
      const u = c.url.replace("http://core-api:8080/api/v1", "");
      if (u === "/me") return jsonRes(200, { ...PERSONA, roles });
      if (u === "/progress") return jsonRes(200, { items: [pt("2026-11-11T09:00:00Z", 90)] });
      if (u.startsWith("/me/applications")) return jsonRes(200, { items: [{}, {}], next_cursor: null });
      if (u === "/cvs") return jsonRes(200, [{ id: "x" }]);
      if (u === "/profile") return jsonRes(200, { skills: [] });
      if (u === "/catalogs/professions") return jsonRes(200, [{ id: "p-1", code: "c", name: "Contador" }]);
      if (u === "/company") return jsonRes(200, { verified: true, membership: { status: "active" } });
      if (u.startsWith("/company/offers")) return jsonRes(200, { items: [{ status: "published", applications_count: 4 }, { status: "draft", applications_count: 9 }], next_cursor: null });
      if (u.startsWith("/admin/companies")) return jsonRes(200, { items: [{}, {}, {}], next_cursor: null });
      return jsonRes(404);
    });
  it("candidata: progreso, aplicaciones y catálogos; nada de empresa ni administración", async () => {
    const { llamadas } = ruta(["applicant"]);
    render(await Dashboard(sp));
    const urls = llamadas.map((c) => c.url);
    expect(urls.some((u) => u.includes("/company"))).toBe(false);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
    expect(tile(t("dashboard.stats.best"))).toHaveTextContent("90");
    expect(tile(t("dashboard.stats.applications"))).toHaveTextContent("2");
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("reclutadora: solo cuenta las aplicaciones de ofertas publicadas y no pide nada de candidata", async () => {
    const { llamadas } = ruta(["recruiter"]);
    render(await Dashboard(sp));
    expect(tile(t("dashboard.company.received"))).toHaveTextContent("4");
    expect(llamadas.some((c) => c.url.includes("/progress") || c.url.includes("/me/applications"))).toBe(false);
  });
  it("administradora: cuenta las empresas por verificar", async () => {
    ruta(["admin"]);
    render(await Dashboard(sp));
    expect(tile(t("dashboard.admin.pending"))).toHaveTextContent("3");
  });
  it("si el backend falla en las lecturas extra, el panel sigue con el saludo y sin cifras inventadas", async () => {
    stubFetch((c) => (c.url.endsWith("/me") ? jsonRes(200, { ...PERSONA, roles: ["applicant"] }) : jsonRes(500)));
    render(await Dashboard(sp));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ana");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("group", { name: t("dashboard.stats.average") })).toBeNull();
  });
});
