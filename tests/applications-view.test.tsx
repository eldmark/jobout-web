/** /applications: «Mis aplicaciones» con estado, historial y lo compartido; retirar con confirmación (FC3, AP7, AP8, AP9). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { AID, APLICADA, APLICACION, APLICACION_DETALLE, EMPRESA, EXTERNA, OID, paginaOfertas } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import { formatDate } from "@/lib/interviews/format";
import ApplicationsView from "@/app/_components/ApplicationsView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const uuid = (n: number) => `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`;
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
const RETIRADA = "2026-11-14T10:00:00.000000Z";

/** Backend simulado: páginas de mis aplicaciones por cursor, detalle por id, retirar y externas. */
function backend(o: { paginas?: Record<string, unknown>; detalle?: (id: string) => Response; retirar?: (c: Llamada) => Response } = {}) {
  return stubFetch((c) => {
    if (c.url.startsWith("/api/applications/external")) return jsonRes(200, paginaOfertas([EXTERNA()]));
    const m = c.url.match(/^\/api\/applications\/([^/?]+)(\/withdraw)?$/);
    if (m && m[2] && c.method === "POST") return o.retirar ? o.retirar(c) : jsonRes(204);
    if (m && c.method === "GET") return o.detalle ? o.detalle(m[1]) : jsonRes(200, APLICACION_DETALLE({ id: m[1] }));
    if (c.url.startsWith("/api/applications")) return jsonRes(200, (o.paginas ?? { "": paginaOfertas([APLICACION()]) })[consulta(c).get("cursor") ?? ""]);
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("list", { name: t("applications.listLabel") }, ESPERA);
const items = () => within(screen.getByRole("list", { name: t("applications.listLabel") })).getAllByRole("listitem").filter((li) => li.classList.contains("tarjeta"));
const boton = (dentro: HTMLElement, clave: Parameters<typeof t>[0]) => within(dentro).getByRole("button", { name: new RegExp(`^${t(clave)}`) });
const retirarBtn = (dentro: HTMLElement) => within(dentro).queryByRole("button", { name: new RegExp(`^${t("applications.withdraw")}`) });
const posts = (ll: Llamada[]) => ll.filter((c) => c.method === "POST");

describe("mis aplicaciones (FC3)", () => {
  it("cargando y luego una tarjeta por aplicación con la oferta, la empresa, el lugar, el estado y la fecha", async () => {
    const { llamadas } = backend();
    render(<ApplicationsView />);
    expect(screen.getByRole("status")).toHaveTextContent(t("applications.loading"));
    await listo();
    const [card] = items();
    expect(within(card).getByRole("link", { name: "Desarrollador backend" })).toHaveAttribute("href", `/offers/${OID}`);
    for (const texto of ["Café Nuevo S.A.", "Mixco, Guatemala", t("applications.status.applied"), tf("applications.appliedOn", { date: formatDate(APLICADA) })]) {
      expect(card, texto).toHaveTextContent(texto);
    }
    expect(Object.fromEntries(consulta(llamadas[0]))).toEqual({ limit: "20" });
  });
  it("cada estado de la máquina tiene su nombre en español", async () => {
    const estados = ["applied", "under_review", "shortlisted", "rejected", "withdrawn", "hired"];
    backend({ paginas: { "": paginaOfertas(estados.map((s, i) => APLICACION({ id: uuid(i), status: s }))) } });
    render(<ApplicationsView />);
    await listo();
    items().forEach((card, i) => expect(card).toHaveTextContent(t(`applications.status.${estados[i]}` as never)));
  });
  it("AP9: una confidencial sin revelar dice «Empresa confidencial»; revelada (la API trae la empresa), su nombre", async () => {
    backend({ paginas: { "": paginaOfertas([APLICACION({ id: uuid(1) }, { confidential: true, company: null }), APLICACION({ id: uuid(2), status: "shortlisted" }, { confidential: true, company: EMPRESA })]) } });
    render(<ApplicationsView />);
    await listo();
    const [oculta, revelada] = items();
    expect(oculta).toHaveTextContent(t("offers.confidential"));
    expect(oculta).not.toHaveTextContent("Café Nuevo");
    expect(revelada).toHaveTextContent("Café Nuevo S.A.");
    expect(revelada).not.toHaveTextContent(t("offers.confidential"));
  });
  it("si la oferta ya no está publicada, el título no enlaza (daría 404) y se dice", async () => {
    backend({ paginas: { "": paginaOfertas([APLICACION({}, { status: "closed" })]) } });
    render(<ApplicationsView />);
    await listo();
    expect(within(items()[0]).queryByRole("link", { name: "Desarrollador backend" })).toBeNull();
    expect(items()[0]).toHaveTextContent(t("applications.offerClosed"));
  });
  it("vacío: lo dice y enlaza a las ofertas", async () => {
    backend({ paginas: { "": paginaOfertas([]) } });
    render(<ApplicationsView />);
    expect(await screen.findByText(t("applications.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("applications.cta") })).toHaveAttribute("href", "/offers");
  });
  it("si falla, error anunciado y reintento", async () => {
    let falla = true;
    stubFetch((c) => (falla ? jsonRes(502) : c.url.startsWith("/api/applications?") ? jsonRes(200, paginaOfertas([APLICACION()])) : jsonRes(404)));
    render(<ApplicationsView />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("applications.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("applications.retry") }));
    await listo();
  });
  it("401 lleva a /sign-in", async () => {
    stubFetch(() => jsonRes(401));
    render(<ApplicationsView />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
  });
  it("«Cargar más» añade la página siguiente con su cursor", async () => {
    const { llamadas } = backend({ paginas: { "": paginaOfertas([APLICACION({ id: uuid(1) })], "c1"), c1: paginaOfertas([APLICACION({ id: uuid(2) })]) } });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("applications.more") }));
    await waitFor(() => expect(items()).toHaveLength(2), ESPERA);
    expect(consulta(llamadas.filter((c) => c.url.startsWith("/api/applications?"))[1]).get("cursor")).toBe("c1");
    expect(screen.queryByRole("button", { name: t("applications.more") })).toBeNull();
  });
});

describe("historial y lo compartido (FC3, AP6, AP7)", () => {
  it("«Ver detalle» despliega el historial en orden y lo que compartí, y se vuelve a plegar", async () => {
    const detalle = APLICACION_DETALLE({
      status: "under_review",
      shared_fields: ["display_name", "skills", "experience", "phone"],
      history: [
        { status: "applied", at: APLICADA },
        { status: "under_review", at: RETIRADA },
      ],
    });
    const { llamadas } = backend({ detalle: () => jsonRes(200, detalle) });
    render(<ApplicationsView />);
    await listo();
    const btn = boton(items()[0], "applications.details.show");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    const historial = await within(items()[0]).findByRole("list", { name: t("applications.history") }, ESPERA);
    expect(within(historial).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      tf("applications.history.entry", { status: t("applications.status.applied"), date: formatDate(APLICADA) }),
      tf("applications.history.entry", { status: t("applications.status.under_review"), date: formatDate(RETIRADA) }),
    ]);
    const compartido = within(items()[0]).getByRole("list", { name: t("applications.shared") });
    expect(within(compartido).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["display_name", "skills", "experience", "phone"].map((f) => t(`apply.field.${f}` as never)));
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(llamadas.some((c) => c.url === `/api/applications/${AID}`)).toBe(true);
    fireEvent.click(btn);
    expect(within(items()[0]).queryByRole("list", { name: t("applications.history") })).toBeNull();
  });
  it("AP7: nunca muestra el motivo, la nota interna ni quién decidió, aunque llegaran", async () => {
    const detalle = { ...APLICACION_DETALLE({ status: "rejected", history: [{ status: "applied", at: APLICADA }, { status: "rejected", at: RETIRADA, note: "Nota interna X", changed_by: "Reclutador Y" }] }), note: "Motivo Z", reason: "Motivo Z" };
    backend({ paginas: { "": paginaOfertas([APLICACION({ status: "rejected" })]) }, detalle: () => jsonRes(200, detalle) });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(boton(items()[0], "applications.details.show"));
    await within(items()[0]).findByRole("list", { name: t("applications.history") }, ESPERA);
    expect(document.body).not.toHaveTextContent(/Nota interna X|Reclutador Y|Motivo Z/);
  });
  it("si el detalle no carga, lo dice y deja reintentar", async () => {
    let falla = true;
    backend({ detalle: () => (falla ? jsonRes(502) : jsonRes(200, APLICACION_DETALLE())) });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(boton(items()[0], "applications.details.show"));
    expect(await within(items()[0]).findByText(t("applications.details.error"), {}, ESPERA)).toBeInTheDocument();
    falla = false;
    fireEvent.click(within(items()[0]).getByRole("button", { name: t("applications.details.retry") }));
    await within(items()[0]).findByRole("list", { name: t("applications.history") }, ESPERA);
  });
});

describe("retirar (FC3, AP8)", () => {
  it("solo se ofrece desde applied, under_review o shortlisted", async () => {
    const estados = ["applied", "under_review", "shortlisted", "rejected", "withdrawn", "hired"];
    backend({ paginas: { "": paginaOfertas(estados.map((s, i) => APLICACION({ id: uuid(i), status: s }))) } });
    render(<ApplicationsView />);
    await listo();
    expect(items().map((card) => retirarBtn(card) !== null)).toEqual([true, true, true, false, false, false]);
  });
  it("el primer clic no retira: pide confirmación diciendo que es definitivo y que la empresa deja de ver lo compartido", async () => {
    const { llamadas } = backend();
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(retirarBtn(items()[0])!);
    const d = screen.getByRole("dialog");
    expect(d).toHaveAccessibleName(t("applications.withdraw.title"));
    expect(d).toHaveTextContent(t("applications.withdraw.warning"));
    expect(d).toHaveTextContent(t("applications.withdraw.stopsSharing"));
    expect(posts(llamadas)).toHaveLength(0);
    fireEvent.click(within(d).getByRole("button", { name: t("applications.withdraw.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(posts(llamadas)).toHaveLength(0);
    expect(retirarBtn(items()[0])).toHaveFocus();
  });
  it("AP8: confirmar retira una sola vez; el estado pasa a «Retirada», el historial se conserva y se anuncia", async () => {
    let retirada = false;
    const { llamadas } = backend({
      retirar: () => {
        retirada = true;
        return jsonRes(204);
      },
      detalle: () =>
        jsonRes(200, retirada ? APLICACION_DETALLE({ status: "withdrawn", history: [{ status: "applied", at: APLICADA }, { status: "withdrawn", at: RETIRADA }] }) : APLICACION_DETALLE()),
    });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(retirarBtn(items()[0])!);
    dobleClic(within(screen.getByRole("dialog")).getByRole("button", { name: t("applications.withdraw.confirm") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), ESPERA);
    expect(posts(llamadas)).toHaveLength(1);
    expect(posts(llamadas)[0].url).toBe(`/api/applications/${AID}/withdraw`);
    expect(items()[0]).toHaveTextContent(t("applications.status.withdrawn"));
    expect(retirarBtn(items()[0])).toBeNull();
    expect(screen.getByText(t("applications.withdraw.done"))).toBeInTheDocument();
    fireEvent.click(boton(items()[0], "applications.details.show"));
    const historial = await within(items()[0]).findByRole("list", { name: t("applications.history") }, ESPERA);
    expect(within(historial).getAllByRole("listitem")).toHaveLength(2);
  });
  it("409 estado_invalido: explica que ya no se puede y muestra el estado vigente", async () => {
    backend({ retirar: () => jsonRes(409, { error: "estado_invalido", status: "hired" }) });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(retirarBtn(items()[0])!);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("applications.withdraw.confirm") }));
    expect(await screen.findByText(tf("applications.withdraw.notAllowed", { status: t("applications.status.hired") }), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(items()[0]).toHaveTextContent(t("applications.status.hired"));
    expect(retirarBtn(items()[0])).toBeNull();
  });
  it("si falla, el diálogo sigue abierto con el error y deja reintentar", async () => {
    let n = 0;
    const { llamadas } = backend({ retirar: () => (n++ === 0 ? jsonRes(502) : jsonRes(204)) });
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(retirarBtn(items()[0])!);
    const confirmar = within(screen.getByRole("dialog")).getByRole("button", { name: t("applications.withdraw.confirm") });
    fireEvent.click(confirmar);
    expect(await within(screen.getByRole("dialog")).findByRole("alert", {}, ESPERA)).toHaveTextContent(t("applications.withdraw.failed"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("applications.withdraw.confirm") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), ESPERA);
    expect(posts(llamadas)).toHaveLength(2);
  });
  it("cada botón dice a qué oferta se refiere (no todos se llaman igual)", async () => {
    backend({ paginas: { "": paginaOfertas([APLICACION({ id: uuid(1) }, { title: "Oferta A" }), APLICACION({ id: uuid(2) }, { title: "Oferta B" })]) } });
    render(<ApplicationsView />);
    await listo();
    expect(screen.getByRole("button", { name: tf("applications.actionLabel", { action: t("applications.withdraw"), title: "Oferta B" }) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tf("applications.actionLabel", { action: t("applications.details.show"), title: "Oferta A" }) })).toBeInTheDocument();
  });
});

describe("pestañas «En JobOut» y «Externas» (FC7)", () => {
  it("dos pestañas; la primera seleccionada; las flechas cambian de pestaña y su panel", async () => {
    const { llamadas } = backend();
    render(<ApplicationsView />);
    await listo();
    const lista = screen.getByRole("tablist", { name: t("applications.tabs.label") });
    const [plataforma, externas] = within(lista).getAllByRole("tab");
    expect(plataforma).toHaveAccessibleName(t("applications.tabs.platform"));
    expect(externas).toHaveAccessibleName(t("applications.tabs.external"));
    expect(plataforma).toHaveAttribute("aria-selected", "true");
    expect(externas).toHaveAttribute("aria-selected", "false");
    expect(externas).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(t("applications.tabs.platform"));
    plataforma.focus();
    fireEvent.keyDown(plataforma, { key: "ArrowRight" });
    expect(externas).toHaveFocus();
    expect(externas).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(t("applications.tabs.external"));
    await waitFor(() => expect(llamadas.some((c) => c.url.startsWith("/api/applications/external"))).toBe(true), ESPERA);
    fireEvent.keyDown(externas, { key: "Home" });
    expect(plataforma).toHaveFocus();
    fireEvent.keyDown(plataforma, { key: "End" });
    expect(externas).toHaveFocus();
    fireEvent.keyDown(externas, { key: "ArrowLeft" });
    expect(plataforma).toHaveAttribute("aria-selected", "true");
  });
  it("clic en «Externas» muestra el registro privado", async () => {
    backend();
    render(<ApplicationsView />);
    await listo();
    fireEvent.click(screen.getByRole("tab", { name: t("applications.tabs.external") }));
    expect(await screen.findByText(t("external.intro"), {}, ESPERA)).toBeInTheDocument();
  });
  it("una sola h1", async () => {
    backend();
    render(<ApplicationsView />);
    await listo();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
