/** /company/offers/[id]/applications: panel del reclutador (FC5, PA2, PA3, PA9, PA10, FC8 y las «Reglas»). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { DETALLE_PANEL, FILA_ANONIMA, FILA_PANEL, OFERTA_DETALLE, OFF, PAP, PAP2 } from "./helpers/company";
import { HOSTIL } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { formatDate } from "@/lib/interviews/format";
import RecruiterPanel from "@/app/_components/RecruiterPanel";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type M = (c: Llamada) => Response | undefined;
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
const listas = (ll: Llamada[]) => ll.filter((c) => c.url.startsWith(`/api/company/offers/${OFF}/applications`));

function backend(o: { oferta?: unknown; filas?: unknown[]; detalle?: (id: string) => Response; extra?: M } = {}) {
  return stubFetch((c) => {
    const x = o.extra?.(c);
    if (x) return x;
    if (c.url === `/api/company/offers/${OFF}`) return jsonRes(200, o.oferta ?? OFERTA_DETALLE({ status: "published" }));
    if (c.url.startsWith(`/api/company/offers/${OFF}/applications`)) return jsonRes(200, { items: o.filas ?? [FILA_PANEL()], next_cursor: null });
    const m = c.url.match(/^\/api\/company\/applications\/([^/]+)(\/[a-z]+)?$/);
    if (m && !m[2] && c.method === "GET") return o.detalle ? o.detalle(m[1]) : jsonRes(200, DETALLE_PANEL({ id: m[1] }));
    if (m && m[2] === "/status") return jsonRes(200, DETALLE_PANEL({ status: (c.body as { to: string }).to, history: [{ from: null, to: "applied", at: "2026-11-13T15:00:00.123456Z", note: null }, { from: "applied", to: (c.body as { to: string }).to, at: "2026-11-14T10:00:00.000000Z", note: (c.body as { note?: string }).note ?? null }] }));
    if (m && m[2] === "/favorite") return jsonRes(204);
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("list", { name: t("panel.listLabel") }, ESPERA);
const filas = () => within(screen.getByRole("list", { name: t("panel.listLabel") })).getAllByRole("listitem");
const detalle = () => screen.findByRole("region", { name: /./ }, ESPERA);
async function abrirDetalle(nombre = "Ana P.") {
  await listo();
  fireEvent.click(screen.getByRole("button", { name: tf("panel.view", { name: nombre }) }));
  return screen.findByRole("region", { name: nombre }, ESPERA);
}
const escritos = (ll: Llamada[]) => ll.filter((c) => c.method !== "GET");

describe("FC5: la lista", () => {
  it("una fila por aplicación con nombre visible, estado y fecha; la oferta en el encabezado", async () => {
    const { llamadas } = backend({ filas: [FILA_PANEL(), FILA_PANEL({ id: PAP2, status: "shortlisted", is_favorite: true, applicant: { display_name: "Luis E." } })] });
    render(<RecruiterPanel offerId={OFF} />);
    await listo();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("panel.title"));
    expect(screen.getByText("Desarrollador backend")).toBeInTheDocument();
    const [a, b] = filas();
    expect(a).toHaveTextContent("Ana P.");
    expect(a).toHaveTextContent(t("applications.status.applied"));
    expect(a).toHaveTextContent(formatDate("2026-11-13T15:00:00.123456Z"));
    expect(b).toHaveTextContent(t("panel.favorite.marked"));
    expect(Object.fromEntries(consulta(listas(llamadas)[0]))).toEqual({ limit: "20" });
  });
  it("PA10: «candidato eliminado», «retirada» o «retención vencida», sin datos ni acciones", async () => {
    backend({ filas: [FILA_ANONIMA("deleted"), FILA_ANONIMA("retention_expired", { id: "x2" }), FILA_ANONIMA("withdrawn", { id: "x3", status: "withdrawn" })] });
    render(<RecruiterPanel offerId={OFF} />);
    await listo();
    const [a, b, c] = filas();
    expect(a).toHaveTextContent(t("panel.availability.deleted"));
    expect(b).toHaveTextContent(t("panel.availability.retention_expired"));
    expect(c).toHaveTextContent(t("panel.availability.withdrawn"));
    for (const f of filas()) expect(within(f).queryByRole("button", { name: t("panel.favorite.toggle") })).toBeNull();
  });
  it("PA9: solo se filtra por estado y favoritos y se ordena por fecha; nada más viaja", async () => {
    const { llamadas } = backend();
    const { container } = render(<RecruiterPanel offerId={OFF} />);
    await listo();
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("method", "post");
    expect(within(form).getAllByRole("combobox")).toHaveLength(3);
    expect(within(form).queryByRole("textbox")).toBeNull();
    expect([...(screen.getByLabelText(t("panel.filter.sort")) as HTMLSelectElement).options].map((o) => o.value)).toEqual(["recent", "oldest"]);
    fireEvent.change(screen.getByLabelText(t("panel.filter.status")), { target: { value: "shortlisted" } });
    fireEvent.change(screen.getByLabelText(t("panel.filter.favorite")), { target: { value: "true" } });
    fireEvent.change(screen.getByLabelText(t("panel.filter.sort")), { target: { value: "oldest" } });
    fireEvent.click(screen.getByRole("button", { name: t("panel.filter.apply") }));
    await waitFor(() => expect(listas(llamadas)).toHaveLength(2), ESPERA);
    expect(Object.fromEntries(consulta(listas(llamadas)[1]))).toEqual({ limit: "20", status: "shortlisted", favorite: "true", sort: "oldest" });
  });
  it("vacío: lo dice", async () => {
    backend({ filas: [] });
    render(<RecruiterPanel offerId={OFF} />);
    expect(await screen.findByText(t("panel.empty"), {}, ESPERA)).toBeInTheDocument();
  });
});

describe("el detalle (PA2, PA3)", () => {
  it("solo lo compartido: sin contacto si no se compartió; el historial con su nota interna", async () => {
    backend();
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    expect(d).toHaveTextContent("Rust");
    expect(d).toHaveTextContent(t("form.level.advanced"));
    expect(d).toHaveTextContent("Acme");
    expect(within(d).queryByRole("heading", { name: t("panel.shared.contact") })).toBeNull();
    expect(within(d).queryByRole("heading", { name: t("panel.shared.languages") })).toBeNull();
    expect(d).toHaveTextContent(tf("panel.history.first", { to: t("applications.status.applied"), date: formatDate("2026-11-13T15:00:00.123456Z") }));
  });
  it("con contacto, idiomas, educación y descripción compartidos, los muestra como texto (SX7)", async () => {
    backend({
      detalle: () =>
        jsonRes(200, DETALLE_PANEL({}, {
          email: "ana@example.test",
          phone: "+502 5555 0000",
          languages: [{ language: { id: "l", code: "en", name: "Inglés" }, proficiency: "advanced" }],
          education: { academic_level: { id: "a", code: "g", name: "Licenciatura" }, profession: null, job_hierarchy: null },
          profile_description: HOSTIL,
          experience: [{ company: "Acme", title: "Dev", start_date: "2022-01-01", end_date: null, description: "APIs de pagos" }],
        })),
    });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    for (const texto of ["ana@example.test", "+502 5555 0000", "Inglés", "Licenciatura", "APIs de pagos", "<b>negrita</b>"]) expect(d, texto).toHaveTextContent(texto);
    expect(d.querySelector("img, script, b")).toBeNull();
    expect(within(d).getByRole("heading", { name: t("panel.shared.contact") })).toBeInTheDocument();
  });
  it("429 al abrir un detalle dice cuánto esperar", async () => {
    backend({ detalle: () => new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "content-type": "application/json", "retry-after": "1200" } }) });
    render(<RecruiterPanel offerId={OFF} />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: tf("panel.view", { name: "Ana P." }) }));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(tf("panel.error.rateLimitedIn", { wait: tf("offers.wait.minutes", { n: 20 }) }));
  });
});

describe("FC5: cambiar de estado con confirmación y marcar favoritos", () => {
  it("solo ofrece las transiciones de la máquina; confirmar envía una vez {to, note} y actualiza detalle y fila", async () => {
    const { llamadas } = backend({ filas: [FILA_PANEL({ status: "under_review" })], detalle: () => jsonRes(200, DETALLE_PANEL({ status: "under_review" })) });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    const opciones = within(d).getAllByRole("button", { name: /^Mover a/ }).map((b) => b.textContent);
    expect(opciones).toEqual([tf("panel.move", { status: t("applications.status.shortlisted") }), tf("panel.move", { status: t("applications.status.rejected") })]);
    fireEvent.click(within(d).getByRole("button", { name: tf("panel.move", { status: t("applications.status.rejected") }) }));
    const dialogo = screen.getByRole("dialog");
    expect(escritos(llamadas)).toHaveLength(0);
    expect(dialogo).toHaveTextContent(t("panel.moveDialog.noteHelp"));
    expect(dialogo).not.toHaveTextContent(t("panel.moveDialog.reveal"));
    fireEvent.change(within(dialogo).getByLabelText(t("panel.moveDialog.note")), { target: { value: " Sin experiencia en Rust " } });
    dobleClic(within(dialogo).getByRole("button", { name: t("panel.moveDialog.confirm") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), ESPERA);
    expect(escritos(llamadas)).toEqual([expect.objectContaining({ url: `/api/company/applications/${PAP}/status`, body: { to: "rejected", note: "Sin experiencia en Rust" } })]);
    expect(filas()[0]).toHaveTextContent(t("applications.status.rejected"));
    expect(d).toHaveTextContent(tf("panel.history.note", { note: "Sin experiencia en Rust" }));
    expect(within(d).queryByRole("button", { name: /^Mover a/ })).toBeNull();
  });
  it("mover a preseleccionada en una oferta confidencial avisa ANTES que revela la empresa", async () => {
    backend({ oferta: OFERTA_DETALLE({ status: "published", is_confidential: true }), filas: [FILA_PANEL({ status: "under_review" })], detalle: () => jsonRes(200, DETALLE_PANEL({ status: "under_review" })) });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    fireEvent.click(within(d).getByRole("button", { name: tf("panel.move", { status: t("applications.status.shortlisted") }) }));
    expect(screen.getByRole("dialog")).toHaveTextContent(t("panel.moveDialog.reveal"));
  });
  it("una nota de más de 500 caracteres no se envía; cancelar no llama a la API", async () => {
    const { llamadas } = backend({ filas: [FILA_PANEL()], detalle: () => jsonRes(200, DETALLE_PANEL()) });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    fireEvent.click(within(d).getByRole("button", { name: tf("panel.move", { status: t("applications.status.under_review") }) }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText(t("panel.moveDialog.note")), { target: { value: "ñ".repeat(501) } });
    fireEvent.click(within(dialogo).getByRole("button", { name: t("panel.moveDialog.confirm") }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent(t("panel.moveDialog.noteTooLong"));
    fireEvent.click(within(dialogo).getByRole("button", { name: t("panel.moveDialog.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(escritos(llamadas)).toHaveLength(0);
  });
  it("409 estado_invalido: lo explica y muestra el estado vigente", async () => {
    backend({ extra: (c) => (c.url.endsWith("/status") ? jsonRes(409, { error: "estado_invalido", status: "withdrawn" }) : undefined) });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    fireEvent.click(within(d).getByRole("button", { name: tf("panel.move", { status: t("applications.status.under_review") }) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("panel.moveDialog.confirm") }));
    expect(await screen.findByText(tf("panel.error.stateNow", { status: t("applications.status.withdrawn") }), {}, ESPERA)).toBeInTheDocument();
    expect(filas()[0]).toHaveTextContent(t("applications.status.withdrawn"));
  });
  it("favorito: PUT al marcar, DELETE al desmarcar, con aria-pressed", async () => {
    const { llamadas } = backend();
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle();
    const fav = within(d).getByRole("button", { name: t("panel.favorite.toggle") });
    expect(fav).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(fav);
    await waitFor(() => expect(fav).toHaveAttribute("aria-pressed", "true"), ESPERA);
    fireEvent.click(fav);
    await waitFor(() => expect(fav).toHaveAttribute("aria-pressed", "false"), ESPERA);
    expect(escritos(llamadas).map((c) => [c.method, c.url])).toEqual([
      ["PUT", `/api/company/applications/${PAP}/favorite`],
      ["DELETE", `/api/company/applications/${PAP}/favorite`],
    ]);
  });
  it("una entrada anónima en el detalle: sin datos, sin mover y sin favorito", async () => {
    backend({ filas: [FILA_ANONIMA("deleted")], detalle: () => jsonRes(200, { ...FILA_ANONIMA("deleted"), offer: { id: OFF, title: "Desarrollador backend" }, history: [] }) });
    render(<RecruiterPanel offerId={OFF} />);
    const d = await abrirDetalle(t("panel.availability.deleted"));
    expect(d).toHaveTextContent(t("panel.noData"));
    expect(within(d).queryByRole("button", { name: /^Mover a/ })).toBeNull();
    expect(within(d).queryByRole("button", { name: t("panel.favorite.toggle") })).toBeNull();
  });
});

describe("FC8 y errores", () => {
  for (const [codigo, k] of [["empresa_no_verificada", "unverified"], ["membresia_vencida", "expired"]] as const) {
    it(`403 ${codigo}: pantalla propia con qué hacer, no un error genérico`, async () => {
      backend({ extra: (c) => (c.url.includes("/applications") ? jsonRes(403, { error: codigo }) : undefined) });
      render(<RecruiterPanel offerId={OFF} />);
      const h = await screen.findByRole("heading", { name: t(`company.gate.${k}.title`) }, ESPERA);
      expect(h.closest("section")).toHaveTextContent(t(`company.gate.${k}.body`));
      expect(screen.getByRole("link", { name: t("panel.toCompany") })).toHaveAttribute("href", "/company");
    });
  }
  it("404: la oferta no es de tu empresa o no existe", async () => {
    backend({ extra: (c) => (c.url.startsWith(`/api/company/offers/${OFF}`) ? jsonRes(404, { error: "no_encontrado" }) : undefined) });
    render(<RecruiterPanel offerId={OFF} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.notFound"));
  });
});

describe("Reglas: los datos del candidato viven solo en el estado de la página", () => {
  it("ni localStorage, ni sessionStorage, ni console.log al usar el panel", async () => {
    const guardar = vi.spyOn(Storage.prototype, "setItem");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    backend({ detalle: () => jsonRes(200, DETALLE_PANEL({}, { email: "ana@example.test" })) });
    render(<RecruiterPanel offerId={OFF} />);
    await abrirDetalle();
    fireEvent.click(screen.getByRole("button", { name: t("panel.favorite.toggle") }));
    await waitFor(() => expect(screen.getByRole("button", { name: t("panel.favorite.toggle") })).toHaveAttribute("aria-pressed", "true"), ESPERA);
    expect(guardar).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
  it("una sola h1 y la región de detalle con nombre", async () => {
    backend();
    render(<RecruiterPanel offerId={OFF} />);
    await abrirDetalle();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await detalle()).toBeInTheDocument();
  });
});
