/** Lista de entrevistas con paginación por cursor y «Cargar más». */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { RESUMEN, pagina, SID } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import { formatDate } from "@/lib/interviews/format";
import InterviewSessions from "@/app/_components/InterviewSessions";
import { leer } from "./helpers/fuentes";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const uuid = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
const sesiones = (desde: number, hasta: number, over: Record<string, unknown> = {}) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => RESUMEN({ id: uuid(desde + i), created_at: `2026-11-${String(28 - (desde + i)).padStart(2, "0")}T09:00:00Z`, ...over }));
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
const listas = (ll: Llamada[]) => ll.filter((c) => c.url.startsWith("/api/interviews"));

/** Paginador de verdad: devuelve páginas según el cursor recibido. */
function paginado(paginas: Record<string, ReturnType<typeof pagina>>, extra: (c: Llamada) => Response | undefined = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.method === "GET" && c.url.startsWith("/api/interviews")) return jsonRes(200, paginas[consulta(c).get("cursor") ?? ""]);
    return jsonRes(404);
  });
}
const filas = () => within(screen.getByRole("table", { name: t("interview.sessions.title") })).getAllByRole("row").slice(1);
const mas = () => screen.queryByRole("button", { name: t("interview.sessions.more") });
const listo = () => screen.findByRole("table", { name: t("interview.sessions.title") }, ESPERA);

describe("primera página", () => {
  it("cargando y luego una fila por sesión con fecha, nivel, recruiter, estado y score", async () => {
    paginado({ "": pagina([RESUMEN(), RESUMEN({ id: uuid(2), status: "in_progress", score: null, completed_at: null, level: { id: "l2", code: "startup", name: "Startup" }, recruiter: { id: "r2", display_name: "Martín" } })]) });
    render(<InterviewSessions />);
    expect(screen.getByRole("status")).toHaveTextContent(t("interview.sessions.loading"));
    await listo();
    const f = filas();
    expect(f).toHaveLength(2);
    expect(f[0]).toHaveTextContent(formatDate("2026-11-09T09:00:00Z"));
    expect(f[0]).toHaveTextContent("Junior");
    expect(f[0]).toHaveTextContent("Ana");
    expect(f[0]).toHaveTextContent(t("interview.sessions.status.completed"));
    expect(f[0]).toHaveTextContent("78");
    expect(f[1]).toHaveTextContent("Startup");
    expect(f[1]).toHaveTextContent("Martín");
    expect(f[1]).toHaveTextContent(t("interview.sessions.status.in_progress"));
    expect(f[1]).toHaveTextContent(t("interview.sessions.noScore"));
    for (const k of ["date", "level", "recruiter", "status", "score", "actions"] as const) {
      expect(screen.getByRole("columnheader", { name: t(`interview.sessions.col.${k}` as "interview.sessions.col.date") })).toBeInTheDocument();
    }
  });
  it("pide la primera página sin cursor y con el tamaño de página", async () => {
    const { llamadas } = paginado({ "": pagina([RESUMEN()]) });
    render(<InterviewSessions />);
    await listo();
    expect(listas(llamadas)).toHaveLength(1);
    expect(consulta(llamadas[0]).get("cursor")).toBeNull();
    expect(consulta(llamadas[0]).get("limit")).toBe("20");
  });
  it("acciones por estado: completada -> resultado y transcripción; en curso o en pausa -> retomar; abandonada -> ninguna", async () => {
    paginado({
      "": pagina([
        RESUMEN({ id: uuid(1) }),
        RESUMEN({ id: uuid(2), status: "in_progress", score: null, completed_at: null }),
        RESUMEN({ id: uuid(3), status: "paused", score: null, completed_at: null }),
        RESUMEN({ id: uuid(4), status: "abandoned", score: null, completed_at: null }),
      ]),
    });
    render(<InterviewSessions />);
    await listo();
    const f = filas();
    const enlaces = (i: number) => within(f[i]).queryAllByRole("link").map((a) => a.getAttribute("href"));
    expect(enlaces(0)).toEqual([`/interviews/${uuid(1)}`, `/interviews/${uuid(1)}/transcript`]);
    expect(enlaces(1)).toEqual([`/interviews/${uuid(2)}`]);
    expect(enlaces(2)).toEqual([`/interviews/${uuid(3)}`]);
    expect(enlaces(3)).toEqual([]);
  });
  it("los enlaces tienen nombre accesible con su contexto (no son todos «Ver transcripción»)", async () => {
    paginado({ "": pagina([RESUMEN({ id: uuid(1) }), RESUMEN({ id: uuid(2), recruiter: { id: "r2", display_name: "Martín" } })]) });
    render(<InterviewSessions />);
    await listo();
    const nombre = (action: string, rec: string) => tf("interview.sessions.actionLabel", { action, level: "Junior", recruiter: rec, date: formatDate("2026-11-09T09:00:00Z") });
    expect(screen.getByRole("link", { name: nombre(t("interview.sessions.viewTranscript"), "Ana") })).toHaveAttribute("href", `/interviews/${uuid(1)}/transcript`);
    expect(screen.getByRole("link", { name: nombre(t("interview.sessions.viewTranscript"), "Martín") })).toHaveAttribute("href", `/interviews/${uuid(2)}/transcript`);
  });
  it("sin sesiones: estado vacío con un llamado a practicar", async () => {
    paginado({ "": pagina([]) });
    render(<InterviewSessions />);
    expect(await screen.findByText(t("interview.sessions.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(mas()).toBeNull();
    expect(screen.getByRole("link", { name: t("interview.sessions.cta") })).toHaveAttribute("href", "/interviews");
  });
  it("si falla, error anunciado y reintento", async () => {
    let falla = true;
    paginado({ "": pagina([RESUMEN()]) }, () => (falla ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<InterviewSessions />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.sessions.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.sessions.retry") }));
    await listo();
  });
  it("401 lleva a /sign-in (esperando la navegación)", async () => {
    paginado({}, () => jsonRes(401, { error: "sesion_expirada" }));
    render(<InterviewSessions />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
    expect(goTo).toHaveBeenCalledTimes(1);
  });
});

describe("«Cargar más» con cursor", () => {
  const PAGINAS = () => ({
    "": pagina(sesiones(1, 3), "cur-1"),
    "cur-1": pagina(sesiones(4, 5), "cur+2/="),
    "cur+2/=": pagina(sesiones(6, 6), null),
  });
  it("sin next_cursor no hay botón", async () => {
    paginado({ "": pagina(sesiones(1, 3), null) });
    render(<InterviewSessions />);
    await listo();
    expect(mas()).toBeNull();
  });
  it("con next_cursor el botón pide la página siguiente con ese cursor y AÑADE las filas (no reemplaza)", async () => {
    const { llamadas } = paginado(PAGINAS());
    render(<InterviewSessions />);
    await listo();
    expect(filas()).toHaveLength(3);
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(5), ESPERA);
    expect(consulta(listas(llamadas)[1]).get("cursor")).toBe("cur-1");
    expect(filas().map((f) => f.querySelector("a")?.getAttribute("href"))).toEqual([1, 2, 3, 4, 5].map((n) => `/interviews/${uuid(n)}`));
    expect(mas()).not.toBeNull();
  });
  it("encadena cursores hasta la última página y entonces el botón desaparece", async () => {
    const { llamadas } = paginado(PAGINAS());
    render(<InterviewSessions />);
    await listo();
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(5), ESPERA);
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(6), ESPERA);
    expect(listas(llamadas).map((c) => consulta(c).get("cursor"))).toEqual([null, "cur-1", "cur+2/="]);
    expect(mas()).toBeNull();
  });
  it("mientras carga: botón deshabilitado, aria-busy y doble clic = una sola petición", async () => {
    let soltar: (r: Response) => void = () => {};
    const { llamadas } = stubFetch((c) => {
      if (!consulta(c).get("cursor")) return jsonRes(200, pagina(sesiones(1, 3), "cur-1"));
      return new Promise<Response>((res) => (soltar = res)) as unknown as Response;
    });
    render(<InterviewSessions />);
    await listo();
    dobleClic(mas()!);
    const b = await screen.findByRole("button", { name: t("interview.sessions.moreLoading") }, ESPERA);
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(listas(llamadas)).toHaveLength(2);
    soltar(jsonRes(200, pagina(sesiones(4, 5), null)));
    await waitFor(() => expect(filas()).toHaveLength(5), ESPERA);
    expect(listas(llamadas)).toHaveLength(2);
  });
  it("si falla al cargar más, conserva lo ya visto, avisa y permite reintentar con el mismo cursor", async () => {
    let falla = true;
    const { llamadas } = paginado(PAGINAS(), (c) => (falla && consulta(c).get("cursor") === "cur-1" ? jsonRes(503, { error: "motor_no_disponible" }) : undefined));
    render(<InterviewSessions />);
    await listo();
    fireEvent.click(mas()!);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.sessions.moreError"));
    expect(filas()).toHaveLength(3);
    falla = false;
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(5), ESPERA);
    expect(listas(llamadas).map((c) => consulta(c).get("cursor"))).toEqual([null, "cur-1", "cur-1"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("no duplica una sesión que el backend repite entre páginas", async () => {
    paginado({ "": pagina(sesiones(1, 3), "cur-1"), "cur-1": pagina(sesiones(3, 4), null) });
    render(<InterviewSessions />);
    await listo();
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(4), ESPERA);
  });
  it("el foco no se pierde: tras cargar más, el foco queda en la primera fila nueva", async () => {
    paginado(PAGINAS());
    render(<InterviewSessions />);
    await listo();
    fireEvent.click(mas()!);
    await waitFor(() => expect(filas()).toHaveLength(5), ESPERA);
    expect(within(filas()[3]).getAllByRole("link")[0]).toHaveFocus();
  });
  it("anuncia cuántas hay en una región de estado", async () => {
    paginado(PAGINAS());
    render(<InterviewSessions />);
    await listo();
    expect(screen.getByRole("status")).toHaveTextContent(tf("interview.sessions.shown", { n: 3 }));
    fireEvent.click(mas()!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(tf("interview.sessions.shown", { n: 5 })), ESPERA);
  });
  it("BUG-002: con una sola entrevista lo dice en singular; con varias, en plural", async () => {
    paginado({ "": pagina([RESUMEN({ id: SID })], null) });
    render(<InterviewSessions />);
    await listo();
    expect(screen.getByRole("status")).toHaveTextContent(/^Mostrando 1 entrevista\.$/);
    cleanup();
    paginado(PAGINAS());
    render(<InterviewSessions />);
    await listo();
    expect(screen.getByRole("status")).toHaveTextContent(/^Mostrando 3 entrevistas\.$/);
  });
});

describe("BUG-005: «Ver resultado» y «Ver transcripción» no salen pegados", () => {
  /** Cuerpos de las reglas cuyo selector (uno de la lista) es exactamente `sel`, sin comentarios. */
  const regla = (sel: string) =>
    [...leer("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, s]) => s.trim().split(/\s*,\s*/).includes(sel))
      .map(([, , cuerpo]) => cuerpo)
      .join(";");

  it("los enlaces de la columna Acciones van juntos en su propio contenedor, no sueltos en la celda", async () => {
    paginado({ "": pagina([RESUMEN({ id: uuid(1) }), RESUMEN({ id: uuid(2), status: "paused", score: null, completed_at: null })]) });
    render(<InterviewSessions />);
    await listo();
    for (const fila of filas()) {
      const celda = within(fila).getAllByRole("cell").at(-1)!;
      const enlaces = within(celda).getAllByRole("link");
      const grupo = enlaces[0].parentElement!;
      expect(grupo).not.toBe(celda);
      expect(grupo).toHaveClass("tabla__acciones");
      for (const a of enlaces) expect(a.parentElement).toBe(grupo);
    }
  });
  it("una sesión sin acciones (abandonada) no deja un contenedor vacío", async () => {
    paginado({ "": pagina([RESUMEN({ id: uuid(1), status: "abandoned", score: null, completed_at: null })]) });
    const { container } = render(<InterviewSessions />);
    await listo();
    expect(container.querySelector(".tabla__acciones")).toBeNull();
  });
  it("el contenedor separa los enlaces con un hueco y deja que bajen enteros; cada enlace no se parte por dentro", () => {
    const grupo = regla(".tabla__acciones");
    expect(grupo).toMatch(/display\s*:\s*(inline-)?flex\b/);
    expect(grupo).toMatch(/flex-wrap\s*:\s*wrap\b/);
    const hueco = grupo.match(/(?:^|[;\s])(?:column-)?gap\s*:\s*([^;]+)/)?.[1].trim() ?? "";
    expect(hueco).not.toBe("");
    expect(hueco).not.toMatch(/^0(?:[a-z%]*)?(?:\s|$)/);
    expect(regla(".tabla__acciones a")).toMatch(/white-space\s*:\s*nowrap\b/);
  });
});

describe("accesibilidad", () => {
  it("una sola h1, tabla con nombre y cabeceras de columna, sin tabindex negativo", async () => {
    paginado({ "": pagina([RESUMEN({ id: SID })], "x") });
    const { container } = render(<InterviewSessions />);
    await listo();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(container.querySelectorAll('[tabindex="-1"]')).toHaveLength(0);
    expect(mas()!.tagName).toBe("BUTTON");
  });
});
