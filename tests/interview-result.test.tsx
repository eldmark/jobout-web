/** F9, F10, F12: resultado con su porqué, confianza oculta si es nula, y borrar la sesión. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { SID, SCORE } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import InterviewResult from "@/app/_components/InterviewResult";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function backend(score: unknown = SCORE(), extra: (c: Llamada) => Response | undefined = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.method === "GET" && c.url === `/api/interviews/${SID}/score`) return jsonRes(200, score);
    return jsonRes(404);
  });
}
const cargado = async () => screen.findByRole("heading", { name: t("interview.result.title") }, ESPERA);

describe("F9 resultado", () => {
  it("muestra cargando y luego el score, la claridad y el desglose con su porqué", async () => {
    backend();
    render(<InterviewResult id={SID} />);
    expect(screen.getByRole("status")).toHaveTextContent(t("interview.result.loading"));
    await cargado();
    expect(screen.getByText(t("interview.result.score")).closest("div")).toHaveTextContent("78");
    expect(screen.getByText(t("interview.result.clarity")).closest("div")).toHaveTextContent("81");
    const lista = screen.getByRole("list", { name: t("interview.result.breakdown") });
    const items = within(lista).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Estructura de la respuesta");
    expect(items[0]).toHaveTextContent(tf("interview.result.points", { score: 45, max: 50 }));
    expect(items[0]).toHaveTextContent("45 / 50");
    expect(items[1]).toHaveTextContent("33 / 50");
    expect(items[0]).not.toHaveTextContent(t("interview.result.outOf"));
    expect(items[0]).toHaveTextContent(t("interview.result.why"));
    expect(items[0]).toHaveTextContent("Ordenaste tu historia en situación, acción y resultado.");
    expect(items[1]).toHaveTextContent("Faltaron cifras o resultados medibles.");
  });
  it("muestra las mejoras concretas", async () => {
    backend();
    render(<InterviewResult id={SID} />);
    await cargado();
    const mejoras = screen.getByRole("list", { name: t("interview.result.improvements") });
    expect(within(mejoras).getAllByRole("listitem").map((l) => l.textContent)).toEqual([
      "Añade un resultado medible a cada historia.",
      "Menciona qué decidiste tú y no solo el equipo.",
    ]);
  });
  it("usa el score que ya llegó al terminar sin volver a pedirlo", async () => {
    const { fn } = backend();
    render(<InterviewResult id={SID} initial={SCORE({ score: 90 })} />);
    await cargado();
    expect(screen.getByText(t("interview.result.score")).closest("div")).toHaveTextContent("90");
    expect(fn).not.toHaveBeenCalled();
  });
  it("tiene enlaces para practicar otra entrevista y ver el progreso", async () => {
    backend();
    render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.getByRole("link", { name: t("interview.result.practiceAgain") })).toHaveAttribute("href", "/interviews");
    expect(screen.getByRole("link", { name: t("interview.result.progressLink") })).toHaveAttribute("href", "/interviews/progress");
  });
  it("el desglose muestra puntos obtenidos sobre el máximo de cada criterio, y suman el score", async () => {
    const sc = SCORE();
    expect(sc.breakdown.reduce((a, c) => a + c.score, 0)).toBe(sc.score);
    backend(SCORE({ breakdown: [{ criterion: "a", label: "A", score: 0, max_points: 10, why: "x" }] }));
    render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.getByText("A").closest("li")).toHaveTextContent("0 / 10");
  });
  it("enlaza a la transcripción de la sesión terminada", async () => {
    backend();
    render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.getByRole("link", { name: t("interview.result.transcriptLink") })).toHaveAttribute("href", `/interviews/${SID}/transcript`);
  });
  it("si falla, error anunciado y reintento", async () => {
    let falla = true;
    backend(SCORE(), (c) => (falla && c.method === "GET" ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<InterviewResult id={SID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.result.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.result.retry") }));
    await cargado();
  });
});

describe("F10 la confianza", () => {
  it("no se muestra cuando es nula: ni etiqueta ni «—»", async () => {
    backend(SCORE({ confidence: null }));
    const { container } = render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.queryByText(t("interview.result.confidence"))).toBeNull();
    expect(container.textContent).not.toMatch(/[—–]|N\/A|null|undefined|NaN/);
  });
  it("sí se muestra cuando tiene valor (voz en el futuro)", async () => {
    backend(SCORE({ confidence: 64 }));
    render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.getByText(t("interview.result.confidence")).closest("div")).toHaveTextContent("64");
  });
  it("un 0 es un valor real y se muestra", async () => {
    backend(SCORE({ confidence: 0 }));
    render(<InterviewResult id={SID} />);
    await cargado();
    expect(screen.getByText(t("interview.result.confidence")).closest("div")).toHaveTextContent("0");
  });
});

describe("F12 borrar la sesión", () => {
  const abrir = () => fireEvent.click(screen.getByRole("button", { name: t("interview.result.delete") }));
  it("el primer clic NO llama a la API; el diálogo dice qué se pierde y que el progreso no cambia", async () => {
    const { llamadas } = backend();
    render(<InterviewResult id={SID} />);
    await cargado();
    abrir();
    const d = screen.getByRole("dialog");
    expect(d).toHaveAccessibleName(t("interview.delete.title"));
    expect(d).toHaveTextContent(t("interview.delete.lossTranscript"));
    expect(d).toHaveTextContent(t("interview.delete.lossScore"));
    expect(d).toHaveTextContent(t("interview.delete.keeps"));
    expect(d).toHaveTextContent(t("interview.delete.irreversible"));
    expect(llamadas.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });
  it("Cancelar cierra sin llamar y devuelve el foco al botón", async () => {
    const { llamadas } = backend();
    render(<InterviewResult id={SID} />);
    await cargado();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.delete.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(llamadas.filter((c) => c.method === "DELETE")).toHaveLength(0);
    expect(screen.getByRole("button", { name: t("interview.result.delete") })).toHaveFocus();
  });
  it("confirmar con doble clic -> un solo DELETE y aviso de que el progreso no cambió", async () => {
    const { llamadas } = backend(SCORE(), (c) => (c.method === "DELETE" ? jsonRes(204) : undefined));
    render(<InterviewResult id={SID} />);
    await cargado();
    abrir();
    const ok = screen.getByRole("button", { name: t("interview.delete.confirm") });
    dobleClic(ok);
    expect(await screen.findByRole("heading", { name: t("interview.deleted.title") }, ESPERA)).toBeInTheDocument();
    expect(screen.getByText(t("interview.deleted.text"))).toBeInTheDocument();
    expect(llamadas.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(llamadas.find((c) => c.method === "DELETE")!.url).toBe(`/api/interviews/${SID}`);
  });
  it("si falla (503) el diálogo sigue con un error en español; un 404 se da por borrado", async () => {
    backend(SCORE(), (c) => (c.method === "DELETE" ? jsonRes(503, { error: "motor_no_disponible" }) : undefined));
    render(<InterviewResult id={SID} />);
    await cargado();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.delete.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByText(t("interview.error.engineDown"), {}, ESPERA)).toBeInTheDocument();
    cleanup();
    backend(SCORE(), (c) => (c.method === "DELETE" ? jsonRes(404, { error: "no_encontrado" }) : undefined));
    render(<InterviewResult id={SID} />);
    await cargado();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.delete.confirm") }));
    expect(await screen.findByRole("heading", { name: t("interview.deleted.title") }, ESPERA)).toBeInTheDocument();
  });
});
