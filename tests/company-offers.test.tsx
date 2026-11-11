/** /company/offers: las ofertas de mi empresa con estado y aplicaciones; crear; avisos de verificación (FC8). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { EMPRESA, FILA_OFERTA, OFF } from "./helpers/company";
import { HOSTIL } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { formatDay } from "@/lib/offers/format";
import CompanyOffers from "@/app/_components/CompanyOffers";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const uuid = (n: number) => `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`;
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
const deOfertas = (ll: Llamada[]) => ll.filter((c) => c.url.startsWith("/api/company/offers"));

function backend(o: { empresa?: unknown; paginas?: Record<string, unknown>; ofertas?: (c: Llamada) => Response | undefined } = {}) {
  return stubFetch((c) => {
    if (c.url === "/api/company") return typeof o.empresa === "number" ? jsonRes(o.empresa, { error: "no_encontrado" }) : jsonRes(200, o.empresa ?? EMPRESA());
    if (c.url.startsWith("/api/company/offers")) {
      const x = o.ofertas?.(c);
      if (x) return x;
      return jsonRes(200, (o.paginas ?? { "": { items: [FILA_OFERTA()], next_cursor: null } })[consulta(c).get("cursor") ?? ""]);
    }
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("list", { name: t("companyOffers.listLabel") }, ESPERA);
const filas = () => within(screen.getByRole("list", { name: t("companyOffers.listLabel") })).getAllByRole("listitem");

describe("mis ofertas", () => {
  it("cada oferta con su título (enlace a editarla), estado, vacantes, publicación y número de aplicaciones (enlace al panel)", async () => {
    const { llamadas } = backend({ paginas: { "": { items: [FILA_OFERTA(), FILA_OFERTA({ id: uuid(2), title: "Borrador", status: "draft", publication_date: null, applications_count: 1, is_confidential: true })], next_cursor: null } } });
    render(<CompanyOffers />);
    await listo();
    const [a, b] = filas();
    expect(within(a).getByRole("link", { name: "Desarrollador backend" })).toHaveAttribute("href", `/company/offers/${OFF}`);
    expect(a).toHaveTextContent(t("companyOffers.status.published"));
    expect(a).toHaveTextContent(tf("offers.published", { date: formatDay("2026-11-12") }));
    expect(within(a).getByRole("link", { name: tf("companyOffers.applications", { n: 3, title: "Desarrollador backend" }) })).toHaveAttribute("href", `/company/offers/${OFF}/applications`);
    expect(b).toHaveTextContent(t("companyOffers.status.draft"));
    expect(b).toHaveTextContent(t("companyOffers.confidential"));
    expect(b).toHaveTextContent(t("companyOffers.notPublished"));
    expect(within(b).getByRole("link", { name: tf("companyOffers.applicationsOne", { title: "Borrador" }) })).toBeInTheDocument();
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[0]))).toEqual({ limit: "20" });
  });
  it("«Crear oferta» lleva a /company/offers/new", async () => {
    backend();
    render(<CompanyOffers />);
    await listo();
    expect(screen.getByRole("link", { name: t("companyOffers.create") })).toHaveAttribute("href", "/company/offers/new");
  });
  it("filtrar por estado pide la primera página con ese estado (y nada más)", async () => {
    const { llamadas } = backend();
    const { container } = render(<CompanyOffers />);
    await listo();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    fireEvent.change(screen.getByLabelText(t("companyOffers.filter.status")), { target: { value: "paused" } });
    fireEvent.click(screen.getByRole("button", { name: t("companyOffers.filter.apply") }));
    await waitFor(() => expect(deOfertas(llamadas)).toHaveLength(2), ESPERA);
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[1]))).toEqual({ limit: "20", status: "paused" });
  });
  it("«Cargar más» añade la página siguiente", async () => {
    backend({ paginas: { "": { items: [FILA_OFERTA()], next_cursor: "c1" }, c1: { items: [FILA_OFERTA({ id: uuid(2) })], next_cursor: null } } });
    render(<CompanyOffers />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("companyOffers.more") }));
    await waitFor(() => expect(filas()).toHaveLength(2), ESPERA);
  });
  it("vacío: lo dice", async () => {
    backend({ paginas: { "": { items: [], next_cursor: null } } });
    render(<CompanyOffers />);
    expect(await screen.findByText(t("companyOffers.empty"), {}, ESPERA)).toBeInTheDocument();
  });
  it("SX7: un título con HTML se pinta como texto", async () => {
    backend({ paginas: { "": { items: [FILA_OFERTA({ title: HOSTIL })], next_cursor: null } } });
    render(<CompanyOffers />);
    await listo();
    expect(filas()[0].querySelector("img, script, b")).toBeNull();
    expect(filas()[0]).toHaveTextContent("<b>negrita</b>");
  });
});

describe("FC8 y permisos", () => {
  it("empresa sin verificar: avisa que no puede publicar y qué hacer; igual se ven y crean borradores", async () => {
    backend({ empresa: EMPRESA({ verified: false, verified_at: null }) });
    render(<CompanyOffers />);
    const h = await screen.findByRole("heading", { name: t("company.gate.unverified.title") }, ESPERA);
    expect(h.closest("section")).toHaveTextContent(t("company.gate.unverified.body"));
    await listo();
    expect(screen.getByRole("link", { name: t("companyOffers.create") })).toBeInTheDocument();
  });
  it("membresía vencida: su propio aviso", async () => {
    backend({ empresa: EMPRESA({ membership: { type: "business", start_date: "2025-01-01", expiration_date: "2025-12-31", status: "expired" } }) });
    render(<CompanyOffers />);
    expect(await screen.findByRole("heading", { name: t("company.gate.expired.title") }, ESPERA)).toBeInTheDocument();
  });
  it("sin empresa (404): lo explica y enlaza a /company, sin error genérico", async () => {
    backend({ empresa: 404, ofertas: () => jsonRes(404, { error: "no_encontrado" }) });
    render(<CompanyOffers />);
    expect(await screen.findByText(t("companyOffers.noCompany"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("companyOffers.toCompany") })).toHaveAttribute("href", "/company");
    expect(screen.queryByText(t("companyOffers.loadError"))).toBeNull();
  });
  it("sin permiso (403 sin_permiso): lo explica", async () => {
    backend({ ofertas: () => jsonRes(403, { error: "sin_permiso" }) });
    render(<CompanyOffers />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.noPermission"));
  });
  it("otro fallo: error anunciado y reintento", async () => {
    let falla = true;
    backend({ ofertas: () => (falla ? jsonRes(502) : undefined) });
    render(<CompanyOffers />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("companyOffers.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("companyOffers.retry") }));
    await listo();
  });
  it("una sola h1", async () => {
    backend();
    render(<CompanyOffers />);
    await listo();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
