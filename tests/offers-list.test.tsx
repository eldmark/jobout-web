/** /offers (FC1 sin puntaje, CA3, SX7, FC7): listado con filtros y «Cargar más» por cursor. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { CI_MIXCO, CONFIDENCIAL, EMPRESA, HOSTIL, OFERTA, OID, PROF, ST_GT, ST_SAC, catalogoOfertas, paginaOfertas } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import { formatDay } from "@/lib/offers/format";
import OffersList from "@/app/_components/OffersList";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const uuid = (n: number) => `66666666-6666-4666-8666-${String(n).padStart(12, "0")}`;
const ofertas = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => OFERTA({ id: uuid(desde + i), title: `Oferta ${desde + i}` }));
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
const deOfertas = (ll: Llamada[]) => ll.filter((c) => c.url.startsWith("/api/offers"));

/** Backend simulado: catálogos y páginas de ofertas según el cursor recibido. */
function backend(paginas: Record<string, ReturnType<typeof paginaOfertas>>, extra: (c: Llamada) => Response | undefined = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    const cat = catalogoOfertas(c.url);
    if (cat) return cat;
    if (c.method === "GET" && c.url.startsWith("/api/offers")) return jsonRes(200, paginas[consulta(c).get("cursor") ?? ""] ?? paginaOfertas([]));
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("list", { name: t("offers.listLabel") }, ESPERA);
const tarjetas = () => within(screen.getByRole("list", { name: t("offers.listLabel") })).getAllByRole("listitem");
const mas = () => screen.queryByRole("button", { name: t("offers.more") });
const filtro = (clave: Parameters<typeof t>[0]) => screen.getByLabelText(t(clave)) as HTMLSelectElement;
const opcionesListas = () => waitFor(() => expect(filtro("offers.filters.profession").options.length).toBeGreaterThan(1), ESPERA);

describe("listado (FC1)", () => {
  it("cargando y luego una tarjeta por oferta: título enlazado al detalle, empresa, lugar, condiciones, vacantes y fecha", async () => {
    backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    expect(screen.getByRole("status")).toHaveTextContent(t("offers.loading"));
    await listo();
    const [card] = tarjetas();
    expect(within(card).getByRole("link", { name: "Desarrollador backend" })).toHaveAttribute("href", `/offers/${OID}`);
    for (const texto of ["Café Nuevo S.A.", "Mixco, Guatemala", "Ingeniería de software", "Tecnología", "Indefinido", "Q8,000 a Q12,000", "Diurna", tf("offers.vacancies", { n: 2 }), tf("offers.published", { date: formatDay("2026-11-12") })]) {
      expect(card, texto).toHaveTextContent(texto);
    }
  });
  it("pide la primera página sin cursor, con limit 20 y sin filtros", async () => {
    const { llamadas } = backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await listo();
    expect(deOfertas(llamadas)).toHaveLength(1);
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[0]))).toEqual({ limit: "20" });
  });
  it("una sola vacante en singular", async () => {
    backend({ "": paginaOfertas([OFERTA({ vacancies: 1 })]) });
    render(<OffersList />);
    await listo();
    expect(tarjetas()[0]).toHaveTextContent(t("offers.vacanciesOne"));
  });
  it("CA3: una confidencial dice «Empresa confidencial», sin nombre ni sitio, aunque la API trajera la empresa", async () => {
    backend({ "": paginaOfertas([CONFIDENCIAL(), CONFIDENCIAL({ id: uuid(9), company: EMPRESA })]) });
    render(<OffersList />);
    await listo();
    for (const card of tarjetas()) {
      expect(card).toHaveTextContent(t("offers.confidential"));
      expect(card).not.toHaveTextContent("Café Nuevo");
      expect(card.querySelector("img")).toBeNull();
      expect(within(card).getAllByRole("link")).toHaveLength(1);
    }
  });
  it("si ya apliqué, la tarjeta lo dice con el estado", async () => {
    backend({ "": paginaOfertas([OFERTA({ my_application: { id: "a", status: "under_review" } })]) });
    render(<OffersList />);
    await listo();
    expect(tarjetas()[0]).toHaveTextContent(tf("offers.appliedBadge", { status: t("applications.status.under_review") }));
  });
  it("FC1 en la 5a no hay puntaje de compatibilidad ni «por qué» (llegan con el matching, 5b)", async () => {
    backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await listo();
    expect(document.body.textContent).not.toMatch(/puntaje|compatib|por qué|match/i);
  });
  it("SX7: un título con HTML o script se pinta como texto, nunca como elementos", async () => {
    backend({ "": paginaOfertas([OFERTA({ title: HOSTIL, company: { ...EMPRESA, name: HOSTIL } })]) });
    render(<OffersList />);
    await listo();
    const card = tarjetas()[0];
    expect(card.querySelector("img, script, b")).toBeNull();
    expect(card).toHaveTextContent("<script>window.__pwned=1</script>");
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
  it("sin ofertas: estado vacío, sin «Cargar más»", async () => {
    backend({ "": paginaOfertas([]) });
    render(<OffersList />);
    expect(await screen.findByText(t("offers.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(mas()).toBeNull();
  });
  it("si falla, error anunciado y reintento", async () => {
    let falla = true;
    backend({ "": paginaOfertas([OFERTA()]) }, (c) => (falla && c.url.startsWith("/api/offers") ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<OffersList />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offers.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("offers.retry") }));
    await listo();
  });
  it("401 lleva a /sign-in", async () => {
    backend({}, (c) => (c.url.startsWith("/api/offers") ? jsonRes(401, { error: "sesion_expirada" }) : undefined));
    render(<OffersList />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
  });
  it("enlaza a «Mis aplicaciones» y de vuelta al panel", async () => {
    backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await listo();
    expect(screen.getByRole("link", { name: t("offers.toApplications") })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("link", { name: t("offers.back") })).toHaveAttribute("href", "/dashboard");
  });
});

describe("«Cargar más» con cursor", () => {
  const PAGINAS = () => ({ "": paginaOfertas(ofertas(1, 3), "cur-1"), "cur-1": paginaOfertas(ofertas(4, 5), null) });
  it("pide la página siguiente con ese cursor, AÑADE las tarjetas y el botón desaparece al final", async () => {
    const { llamadas } = backend(PAGINAS());
    render(<OffersList />);
    await listo();
    expect(tarjetas()).toHaveLength(3);
    fireEvent.click(mas()!);
    await waitFor(() => expect(tarjetas()).toHaveLength(5), ESPERA);
    expect(consulta(deOfertas(llamadas)[1]).get("cursor")).toBe("cur-1");
    expect(mas()).toBeNull();
  });
  it("el foco pasa a la primera tarjeta nueva y el total se anuncia", async () => {
    backend(PAGINAS());
    render(<OffersList />);
    await listo();
    expect(screen.getByRole("status")).toHaveTextContent(tf("offers.shown", { n: 3 }));
    fireEvent.click(mas()!);
    await waitFor(() => expect(tarjetas()).toHaveLength(5), ESPERA);
    expect(within(tarjetas()[3]).getByRole("link")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(tf("offers.shown", { n: 5 }));
  });
  it("si falla, conserva lo visto, avisa y reintenta con el mismo cursor", async () => {
    let falla = true;
    const { llamadas } = backend(PAGINAS(), (c) => (falla && consulta(c).get("cursor") === "cur-1" ? jsonRes(503) : undefined));
    render(<OffersList />);
    await listo();
    fireEvent.click(mas()!);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offers.moreError"));
    expect(tarjetas()).toHaveLength(3);
    falla = false;
    fireEvent.click(mas()!);
    await waitFor(() => expect(tarjetas()).toHaveLength(5), ESPERA);
    expect(deOfertas(llamadas).map((c) => consulta(c).get("cursor"))).toEqual([null, "cur-1", "cur-1"]);
  });
  it("no duplica una oferta que el backend repite entre páginas", async () => {
    backend({ "": paginaOfertas(ofertas(1, 3), "cur-1"), "cur-1": paginaOfertas(ofertas(3, 4), null) });
    render(<OffersList />);
    await listo();
    fireEvent.click(mas()!);
    await waitFor(() => expect(tarjetas()).toHaveLength(4), ESPERA);
  });
});

describe("filtros (FC1, CA2)", () => {
  it("los ocho filtros del contrato y el orden, cada uno con su etiqueta; sin buscador de texto ni filtro por empresa", async () => {
    backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await opcionesListas();
    for (const k of ["profession", "state", "city", "contract", "salary", "shift", "sector", "hierarchy", "sort"] as const) {
      expect(filtro(`offers.filters.${k}`).tagName).toBe("SELECT");
    }
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText(/empresa/i)).toBeNull();
  });
  it("el municipio depende del departamento: deshabilitado hasta elegir uno, y se carga con state_id", async () => {
    const { llamadas } = backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await opcionesListas();
    expect(filtro("offers.filters.city")).toBeDisabled();
    expect(filtro("offers.filters.city")).toHaveAccessibleDescription(t("offers.filters.cityFirst"));
    fireEvent.change(filtro("offers.filters.state"), { target: { value: ST_GT } });
    await waitFor(() => expect(filtro("offers.filters.city")).not.toBeDisabled(), ESPERA);
    expect(within(filtro("offers.filters.city")).getByRole("option", { name: "Mixco" })).toBeInTheDocument();
    expect(llamadas.some((c) => c.url === `/api/catalogs/cities?state_id=${ST_GT}`)).toBe(true);
    fireEvent.change(filtro("offers.filters.city"), { target: { value: CI_MIXCO } });
    fireEvent.change(filtro("offers.filters.state"), { target: { value: ST_SAC } });
    await waitFor(() => expect(within(filtro("offers.filters.city")).getByRole("option", { name: "Antigua Guatemala" })).toBeInTheDocument(), ESPERA);
    expect(filtro("offers.filters.city").value).toBe("");
  });
  it("«Filtrar» pide la primera página con los filtros elegidos y reemplaza el listado; «Cargar más» los conserva", async () => {
    const { llamadas } = backend({ "": paginaOfertas(ofertas(1, 2), "cur-1"), "cur-1": paginaOfertas(ofertas(3, 3)) });
    render(<OffersList />);
    await listo();
    await opcionesListas();
    fireEvent.change(filtro("offers.filters.profession"), { target: { value: PROF } });
    fireEvent.change(filtro("offers.filters.state"), { target: { value: ST_GT } });
    await waitFor(() => expect(filtro("offers.filters.city")).not.toBeDisabled(), ESPERA);
    fireEvent.change(filtro("offers.filters.city"), { target: { value: CI_MIXCO } });
    fireEvent.change(filtro("offers.filters.sort"), { target: { value: "oldest" } });
    // Cambiar un filtro no dispara nada hasta pulsar «Filtrar».
    expect(deOfertas(llamadas)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: t("offers.filters.apply") }));
    await waitFor(() => expect(deOfertas(llamadas)).toHaveLength(2), ESPERA);
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[1]))).toEqual({ limit: "20", sort: "oldest", profession_id: PROF, state_id: ST_GT, city_id: CI_MIXCO });
    await listo();
    fireEvent.click(mas()!);
    await waitFor(() => expect(deOfertas(llamadas)).toHaveLength(3), ESPERA);
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[2]))).toEqual({ limit: "20", cursor: "cur-1", sort: "oldest", profession_id: PROF, state_id: ST_GT, city_id: CI_MIXCO });
  });
  it("«Quitar filtros» vuelve a pedir sin filtros y limpia el formulario", async () => {
    const { llamadas } = backend({ "": paginaOfertas([OFERTA()]) });
    render(<OffersList />);
    await opcionesListas();
    fireEvent.change(filtro("offers.filters.profession"), { target: { value: PROF } });
    fireEvent.click(screen.getByRole("button", { name: t("offers.filters.apply") }));
    await waitFor(() => expect(deOfertas(llamadas)).toHaveLength(2), ESPERA);
    fireEvent.click(screen.getByRole("button", { name: t("offers.filters.clear") }));
    await waitFor(() => expect(deOfertas(llamadas)).toHaveLength(3), ESPERA);
    expect(Object.fromEntries(consulta(deOfertas(llamadas)[2]))).toEqual({ limit: "20" });
    expect(filtro("offers.filters.profession").value).toBe("");
  });
  it("con filtros y sin resultados, el vacío lo dice y sugiere quitar alguno", async () => {
    backend({ "": paginaOfertas([OFERTA()]) }, (c) => (c.url.startsWith("/api/offers") && consulta(c).get("profession_id") ? jsonRes(200, paginaOfertas([])) : undefined));
    render(<OffersList />);
    await opcionesListas();
    fireEvent.change(filtro("offers.filters.profession"), { target: { value: PROF } });
    fireEvent.click(screen.getByRole("button", { name: t("offers.filters.apply") }));
    expect(await screen.findByText(t("offers.emptyFiltered"), {}, ESPERA)).toBeInTheDocument();
  });
  it("si los catálogos no cargan, lo avisa y el listado se ve igual", async () => {
    backend({ "": paginaOfertas([OFERTA()]) }, (c) => (c.url.startsWith("/api/catalogs") ? jsonRes(502) : undefined));
    render(<OffersList />);
    await listo();
    expect(await screen.findByText(t("offers.filters.loadError"), {}, ESPERA)).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(1);
  });
  it("el formulario de filtros se envía por POST y no recarga la página (BUG-001)", async () => {
    backend({ "": paginaOfertas([OFERTA()]) });
    const { container } = render(<OffersList />);
    await opcionesListas();
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("method", "post");
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("accesibilidad (FC7)", () => {
  it("una sola h1, la lista tiene nombre y cada tarjeta un título h2", async () => {
    backend({ "": paginaOfertas(ofertas(1, 2)) });
    render(<OffersList />);
    await listo();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(["Oferta 1", "Oferta 2"]));
  });
});
