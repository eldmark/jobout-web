/** F11: progreso con los cinco niveles, desbloqueos, mejor score y evolución. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { LEVELS, PROGRESO, items } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { formatDate } from "@/lib/interviews/format";
import ProgressView from "@/app/_components/ProgressView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function backend(levels: unknown = LEVELS, progreso: unknown = PROGRESO) {
  return stubFetch((c) => {
    if (c.url === "/api/levels") return typeof levels === "number" ? jsonRes(levels) : jsonRes(200, items(levels as unknown[]));
    if (c.url === "/api/progress") return typeof progreso === "number" ? jsonRes(progreso) : jsonRes(200, items(progreso as unknown[]));
    return jsonRes(404);
  });
}
const niveles = async () => within(await screen.findByRole("list", { name: t("progress.levels") }, ESPERA)).getAllByRole("listitem");

describe("F11 los cinco niveles", () => {
  it("cargando, y luego cinco niveles en orden", async () => {
    backend();
    render(<ProgressView />);
    expect(screen.getByRole("status")).toHaveTextContent(t("progress.loading"));
    const items = await niveles();
    expect(items).toHaveLength(5);
    expect(items.map((i) => within(i).getByRole("heading").textContent)).toEqual(["Junior", "Startup", "Amazon", "Google", "McKinsey"]);
  });
  it("indica cuáles están desbloqueados, el mejor score y las sesiones completadas", async () => {
    backend();
    render(<ProgressView />);
    const items = await niveles();
    expect(items[0]).toHaveTextContent(t("progress.unlocked"));
    expect(items[0]).toHaveTextContent("72");
    expect(items[0]).toHaveTextContent(`${t("progress.sessions")}: 3`);
    expect(items[1]).toHaveTextContent(t("progress.locked"));
    expect(items[1]).not.toHaveTextContent(t("progress.unlocked"));
    expect(items[1]).toHaveTextContent(t("progress.noBest"));
    expect(items[2]).toHaveTextContent(t("progress.unavailable"));
  });
  it("ordena por position aunque la API los devuelva desordenados", async () => {
    backend([...LEVELS].reverse());
    render(<ProgressView />);
    const items = await niveles();
    expect(within(items[0]).getByRole("heading")).toHaveTextContent("Junior");
  });
});

describe("F11 la evolución", () => {
  it("lista las sesiones en orden cronológico con fecha, nivel, recruiter y score, y resume la mejora", async () => {
    backend(LEVELS, [...PROGRESO].reverse());
    render(<ProgressView />);
    const tabla = await screen.findByRole("table", { name: t("progress.evolution") }, ESPERA);
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Ana");
    expect(filas[0]).toHaveTextContent("60");
    expect(filas[1]).toHaveTextContent("Martín");
    expect(filas[1]).toHaveTextContent("72");
    for (const k of ["progress.col.date", "progress.col.level", "progress.col.recruiter", "progress.col.score"] as const) {
      expect(within(tabla).getByRole("columnheader", { name: t(k) })).toBeInTheDocument();
    }
    expect(screen.getByText(tf("progress.evolution.up", { n: 12 }))).toBeInTheDocument();
  });
  it.each([
    [70, 71, "Subiste 1 punto desde tu primera entrevista."],
    [70, 82, "Subiste 12 puntos desde tu primera entrevista."],
    [70, 69, "Tu último score está 1 punto por debajo del de tu primera entrevista. Sigue practicando."],
    [70, 64, "Tu último score está 6 puntos por debajo del de tu primera entrevista. Sigue practicando."],
  ])("BUG-002: de %i a %i dice «%s» (singular con 1 punto)", async (primero, ultimo, texto) => {
    backend(LEVELS, [{ ...PROGRESO[0], score: primero }, { ...PROGRESO[1], score: ultimo }]);
    render(<ProgressView />);
    expect(await screen.findByText(texto, {}, ESPERA)).toBeInTheDocument();
  });
  it("si bajó, lo dice con ánimo; si igual, también", async () => {
    backend(LEVELS, [{ ...PROGRESO[0], score: 80 }, { ...PROGRESO[1], score: 74 }]);
    render(<ProgressView />);
    expect(await screen.findByText(tf("progress.evolution.down", { n: 6 }), {}, ESPERA)).toBeInTheDocument();
    cleanup();
    backend(LEVELS, [{ ...PROGRESO[0], score: 70 }, { ...PROGRESO[1], score: 70 }]);
    render(<ProgressView />);
    expect(await screen.findByText(t("progress.evolution.same"), {}, ESPERA)).toBeInTheDocument();
  });
  it("las fechas salen en es-GT", async () => {
    backend(LEVELS, PROGRESO);
    render(<ProgressView />);
    const tabla = await screen.findByRole("table", { name: t("progress.evolution") }, ESPERA);
    expect(within(tabla).getAllByRole("row")[1]).toHaveTextContent(formatDate("2026-11-01T10:00:00Z"));
    expect(formatDate("2026-11-01T10:00:00Z")).toMatch(/2026/);
  });
  it("con una sola sesión no hay comparación", async () => {
    backend(LEVELS, [PROGRESO[0]]);
    render(<ProgressView />);
    expect(await screen.findByText(t("progress.evolution.first"), {}, ESPERA)).toBeInTheDocument();
  });
  it("sin sesiones completadas: estado vacío diseñado con un llamado a practicar", async () => {
    backend(LEVELS, []);
    render(<ProgressView />);
    expect(await screen.findByText(t("progress.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("link", { name: t("progress.cta") })).toHaveAttribute("href", "/interviews");
  });
});

describe("estados de error", () => {
  it("si falla algo, error anunciado y reintento", async () => {
    let falla = true;
    stubFetch((c) => {
      if (falla && c.url === "/api/progress") return jsonRes(502, { error: "servicio_no_disponible" });
      return c.url === "/api/levels" ? jsonRes(200, items(LEVELS)) : jsonRes(200, items(PROGRESO));
    });
    render(<ProgressView />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("progress.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("progress.retry") }));
    expect(await screen.findByRole("table", {}, ESPERA)).toBeInTheDocument();
  });
});
