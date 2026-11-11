/** HU-15: transcripción de solo lectura de una entrevista terminada. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { SID, SESION, T1, RESP } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import { formatDate } from "@/lib/interviews/format";
import InterviewTranscript from "@/app/_components/InterviewTranscript";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import TranscriptPage from "@/app/interviews/[id]/transcript/page";

const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const TURNOS = [
  // desordenados a propósito: la vista ordena por seq
  RESP(2, "Hice una API de pagos"),
  T1,
  { seq: 3, speaker: "recruiter", kind: "follow_up", text: "¿Qué resultado medible tuvo?" },
  RESP(4, "Bajó el tiempo de cobro a la mitad"),
  { seq: 5, speaker: "recruiter", kind: "closing", text: "Gracias, terminamos." },
];
const COMPLETA = () => SESION({ status: "completed", turns: TURNOS });

function backend(sesion: unknown = COMPLETA(), extra: (c: Llamada) => Response | undefined = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.method === "GET" && c.url === `/api/interviews/${SID}`) return typeof sesion === "number" ? jsonRes(sesion, { error: "no_encontrado" }) : jsonRes(200, sesion);
    return jsonRes(404);
  });
}
/** Espera a que termine de cargar. El h1 ya está mientras carga (con `aria-busy`): verlo no alcanza. */
async function cargado() {
  await screen.findByRole("heading", { level: 1, name: t("interview.transcript.title") }, ESPERA);
  await waitFor(() => expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy"), ESPERA);
}
const lista = () => screen.getByRole("list", { name: t("interview.transcript.messages") });

describe("transcripción de una sesión completada", () => {
  it("muestra cargando y luego los turnos en orden por seq, con quién habló y el tipo de turno", async () => {
    backend();
    render(<InterviewTranscript id={SID} />);
    expect(screen.getByRole("status")).toHaveTextContent(t("interview.transcript.loading"));
    await cargado();
    const items = within(lista()).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining(T1.text),
      expect.stringContaining("Hice una API de pagos"),
      expect.stringContaining("¿Qué resultado medible tuvo?"),
      expect.stringContaining("Bajó el tiempo de cobro a la mitad"),
      expect.stringContaining("Gracias, terminamos."),
    ]);
    expect(items[0]).toHaveTextContent("Ana");
    expect(items[1]).toHaveTextContent(t("interview.room.you"));
    expect(items[0]).toHaveTextContent(t("interview.transcript.kind.question"));
    expect(items[1]).toHaveTextContent(t("interview.transcript.kind.answer"));
    expect(items[2]).toHaveTextContent(t("interview.transcript.kind.follow_up"));
    expect(items[4]).toHaveTextContent(t("interview.transcript.kind.closing"));
  });
  it("encabezado con nivel, recruiter y fecha en es-GT", async () => {
    backend();
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(screen.getByText(tf("interview.transcript.meta", { level: "Junior", recruiter: "Ana", date: formatDate("2026-11-09T09:00:00Z") }))).toBeInTheDocument();
  });
  it("es de solo lectura: sin campo de texto, sin enviar, pausar ni terminar", async () => {
    backend();
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(screen.queryByRole("textbox")).toBeNull();
    for (const k of ["interview.room.send", "interview.room.pause", "interview.room.finish", "interview.room.abandon"] as const) {
      expect(screen.queryByRole("button", { name: t(k) })).toBeNull();
    }
    expect(screen.getByText(t("interview.transcript.readOnly"))).toBeInTheDocument();
  });
  it("solo hace GET de la sesión (ninguna mutación)", async () => {
    const { llamadas } = backend();
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(llamadas.map((c) => `${c.method} ${c.url}`)).toEqual([`GET /api/interviews/${SID}`]);
  });
  it("el texto se muestra como texto, nunca como HTML", async () => {
    backend(SESION({ status: "completed", turns: [T1, RESP(2, "<img src=x onerror=alert(1)> <b>negrita</b>")] }));
    const { container } = render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(container.querySelector("img, b")).toBeNull();
    expect(lista()).toHaveTextContent("<b>negrita</b>");
  });
  it("tiene enlaces para volver al resultado y a todas las entrevistas, con nombre accesible", async () => {
    backend();
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(screen.getByRole("link", { name: t("interview.transcript.back") })).toHaveAttribute("href", `/interviews/${SID}`);
    expect(screen.getByRole("link", { name: t("interview.transcript.sessionsLink") })).toHaveAttribute("href", "/interviews/sessions");
  });
  it("accesible: una sola h1, lista con nombre y turnos con el autor legible", async () => {
    backend();
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.body.querySelectorAll('[tabindex="-1"]')).toHaveLength(0);
    expect(within(within(lista()).getAllByRole("listitem")[0]).getByText("Ana", { selector: "strong" })).toBeInTheDocument();
  });
});

describe("estados: vacío, error, no terminada, no encontrada", () => {
  it("una sesión terminada sin turnos muestra un estado vacío diseñado", async () => {
    backend(SESION({ status: "completed", turns: [] }));
    render(<InterviewTranscript id={SID} />);
    await cargado();
    expect(screen.getByText(t("interview.transcript.empty"))).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: t("interview.transcript.messages") })).toBeNull();
  });
  it("si falla la carga, error anunciado y reintento", async () => {
    let falla = true;
    backend(COMPLETA(), (c) => (falla ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<InterviewTranscript id={SID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.transcript.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.transcript.retry") }));
    await cargado();
  });
  it("404 -> «no encontramos esa entrevista» sin botón de reintento", async () => {
    backend(404);
    render(<InterviewTranscript id={SID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.error.notFound"));
    expect(screen.queryByRole("button", { name: t("interview.transcript.retry") })).toBeNull();
    expect(screen.getByRole("link", { name: t("interview.transcript.sessionsLink") })).toHaveAttribute("href", "/interviews/sessions");
  });
  for (const estado of ["in_progress", "paused", "abandoned"]) {
    it(`una sesión ${estado} no muestra la transcripción: explica y lleva a la entrevista`, async () => {
      backend(SESION({ status: estado, turns: TURNOS }));
      render(<InterviewTranscript id={SID} />);
      expect(await screen.findByText(t("interview.transcript.notFinished"), {}, ESPERA)).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: t("interview.transcript.messages") })).toBeNull();
      expect(screen.queryByText("Hice una API de pagos")).toBeNull();
      expect(screen.getByRole("link", { name: t("interview.transcript.goToRoom") })).toHaveAttribute("href", `/interviews/${SID}`);
    });
  }
  it("401 lleva a /sign-in (se espera la navegación, para que no se filtre al test siguiente)", async () => {
    backend(COMPLETA(), () => jsonRes(401, { error: "sesion_expirada" }));
    render(<InterviewTranscript id={SID} />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
    expect(goTo).toHaveBeenCalledTimes(1);
  });
});

describe("página /interviews/[id]/transcript", () => {
  it("un id que no es UUID es 404 sin renderizar nada", async () => {
    await expect(TranscriptPage({ params: Promise.resolve({ id: "no-es-uuid" }) })).rejects.toThrow("NOT_FOUND");
  });
  it("un UUID renderiza la transcripción de esa sesión", async () => {
    backend();
    render(await TranscriptPage({ params: Promise.resolve({ id: SID }) }));
    await cargado();
  });
});
