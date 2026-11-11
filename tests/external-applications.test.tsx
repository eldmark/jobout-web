/** Pestaña «Externas» (HU-32): registro manual y privado de aplicaciones hechas fuera de JobOut. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { EID, EXTERNA, HOSTIL, paginaOfertas } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { formatDay } from "@/lib/offers/format";
import { fiveYearsBefore, todayLocal } from "@/lib/offers/external";
import ExternalApplications from "@/app/_components/ExternalApplications";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const E2 = "88888888-8888-4888-8888-888888888889";
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;

/** Backend simulado del registro externo. */
function backend(o: { paginas?: Record<string, unknown>; crear?: (c: Llamada) => Response; cambiar?: (c: Llamada) => Response } = {}) {
  return stubFetch((c) => {
    if (c.url === "/api/applications/external" && c.method === "POST") return o.crear ? o.crear(c) : jsonRes(201, EXTERNA({ id: E2, ...(c.body as object) }));
    if (c.url.startsWith("/api/applications/external/") && (c.method === "PUT" || c.method === "DELETE")) return o.cambiar ? o.cambiar(c) : jsonRes(204);
    if (c.url.startsWith("/api/applications/external") && c.method === "GET") return jsonRes(200, (o.paginas ?? { "": paginaOfertas([EXTERNA()]) })[consulta(c).get("cursor") ?? ""]);
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("list", { name: t("external.listLabel") }, ESPERA);
const items = () => within(screen.getByRole("list", { name: t("external.listLabel") })).getAllByRole("listitem");
const campo = (clave: Parameters<typeof t>[0]) => screen.getByLabelText(t(clave)) as HTMLInputElement;
const guardar = () => screen.getByRole("button", { name: t("external.save") });
const escritos = (ll: Llamada[]) => ll.filter((c) => c.method !== "GET");

function llenar(v: { company?: string; position?: string; date?: string; status?: string; notes?: string }) {
  if (v.company !== undefined) fireEvent.change(campo("external.field.company"), { target: { value: v.company } });
  if (v.position !== undefined) fireEvent.change(campo("external.field.position"), { target: { value: v.position } });
  if (v.date !== undefined) fireEvent.change(campo("external.field.appliedOn"), { target: { value: v.date } });
  if (v.status !== undefined) fireEvent.change(campo("external.field.status"), { target: { value: v.status } });
  if (v.notes !== undefined) fireEvent.change(campo("external.field.notes"), { target: { value: v.notes } });
}

describe("listado", () => {
  it("dice que es privado; cada registro con empresa, puesto, fecha, estado y notas", async () => {
    backend();
    render(<ExternalApplications />);
    expect(screen.getByText(t("external.intro"))).toBeInTheDocument();
    await listo();
    const [r] = items();
    for (const texto of ["Banco X", "Analista", formatDay("2026-11-05"), t("external.status.interviewing"), "Hablé con RRHH, esperan al 20."]) expect(r, texto).toHaveTextContent(texto);
  });
  it("los seis estados tienen nombre en español", async () => {
    const estados = ["applied", "interviewing", "offer", "rejected", "withdrawn", "accepted"];
    backend({ paginas: { "": paginaOfertas(estados.map((s, i) => EXTERNA({ id: `88888888-8888-4888-8888-00000000000${i}`, status: s }))) } });
    render(<ExternalApplications />);
    await listo();
    items().forEach((r, i) => expect(r).toHaveTextContent(t(`external.status.${estados[i]}` as never)));
  });
  it("las notas y los nombres se pintan como texto (SX7)", async () => {
    backend({ paginas: { "": paginaOfertas([EXTERNA({ notes: HOSTIL, company_name: HOSTIL })]) } });
    render(<ExternalApplications />);
    await listo();
    expect(items()[0].querySelector("img, script, b")).toBeNull();
    expect(items()[0]).toHaveTextContent("<b>negrita</b>");
  });
  it("vacío: lo dice y ofrece anotar una", async () => {
    backend({ paginas: { "": paginaOfertas([]) } });
    render(<ExternalApplications />);
    expect(await screen.findByText(t("external.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("external.add") })).toBeInTheDocument();
  });
  it("si falla, error anunciado y reintento", async () => {
    let falla = true;
    stubFetch((c) => (falla ? jsonRes(502) : jsonRes(200, paginaOfertas([EXTERNA()]))));
    render(<ExternalApplications />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("external.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("external.retry") }));
    await listo();
  });
  it("«Cargar más» añade la página siguiente", async () => {
    backend({ paginas: { "": paginaOfertas([EXTERNA()], "c1"), c1: paginaOfertas([EXTERNA({ id: E2, company_name: "Banco Y" })]) } });
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.more") }));
    await waitFor(() => expect(items()).toHaveLength(2), ESPERA);
  });
});

describe("anotar una aplicación", () => {
  it("abre un formulario por POST con el foco en el primer campo y la fecha limitada a hoy y cinco años atrás", async () => {
    backend();
    const { container } = render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.add") }));
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    expect(campo("external.field.company")).toHaveFocus();
    const hoy = todayLocal();
    expect(campo("external.field.appliedOn")).toHaveAttribute("type", "date");
    expect(campo("external.field.appliedOn")).toHaveAttribute("max", hoy);
    expect(campo("external.field.appliedOn")).toHaveAttribute("min", fiveYearsBefore(hoy));
    expect(screen.getByText(t("external.field.notesHelp"))).toBeInTheDocument();
  });
  it("envía una sola vez los cinco campos, recortados y con las notas vacías como null; aparece en la lista y se anuncia", async () => {
    const { llamadas } = backend();
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.add") }));
    llenar({ company: "  Banco Y ", position: "Analista Jr", date: todayLocal(), status: "applied", notes: "  " });
    dobleClic(guardar());
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ method: "POST", url: "/api/applications/external" });
    expect(escritos(llamadas)[0].body).toEqual({ company_name: "Banco Y", position: "Analista Jr", applied_on: todayLocal(), status: "applied", notes: null });
    expect(await screen.findByText(t("external.saved"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("external.save") })).toBeNull();
    expect(items().map((r) => r.textContent).join(" ")).toContain("Banco Y");
  });
  it("sin datos válidos no envía: marca cada campo, lo anuncia y lleva el foco al primero con error", async () => {
    const { llamadas } = backend();
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.add") }));
    llenar({ company: "X", notes: "ñ".repeat(2001) });
    fireEvent.click(guardar());
    expect(escritos(llamadas)).toHaveLength(0);
    expect(campo("external.field.company")).toHaveAttribute("aria-invalid", "true");
    expect(campo("external.field.company")).toHaveAccessibleDescription(t("external.error.company"));
    expect(campo("external.field.position")).toHaveAccessibleDescription(t("external.error.position"));
    expect(campo("external.field.appliedOn")).toHaveAccessibleDescription(t("external.error.appliedOn"));
    expect(campo("external.field.status")).toHaveAccessibleDescription(t("external.error.status"));
    expect(campo("external.field.notes")).toHaveAccessibleDescription(expect.stringContaining(t("external.error.notes")));
    expect(screen.getByRole("alert")).toHaveTextContent(t("external.error.summary"));
    expect(campo("external.field.company")).toHaveFocus();
  });
  it("409 limite_de_registros explica el máximo; 422 pide revisar los datos", async () => {
    let r = jsonRes(409, { error: "limite_de_registros" });
    backend({ crear: () => r });
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.add") }));
    llenar({ company: "Banco Y", position: "Analista", date: todayLocal(), status: "applied" });
    fireEvent.click(guardar());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offers.error.externalLimit"));
    r = jsonRes(422, { error: "datos_invalidos" });
    fireEvent.click(guardar());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(t("offers.error.invalid")), ESPERA);
  });
  it("«Cancelar» cierra el formulario sin enviar", async () => {
    const { llamadas } = backend();
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(screen.getByRole("button", { name: t("external.add") }));
    fireEvent.click(screen.getByRole("button", { name: t("external.cancel") }));
    expect(screen.queryByRole("button", { name: t("external.save") })).toBeNull();
    expect(escritos(llamadas)).toHaveLength(0);
    expect(screen.getByRole("button", { name: t("external.add") })).toHaveFocus();
  });
});

describe("editar y borrar", () => {
  it("«Editar» abre el formulario con los datos y guarda con PUT el registro completo", async () => {
    const { llamadas } = backend();
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(within(items()[0]).getByRole("button", { name: tf("external.actionLabel", { action: t("external.edit"), position: "Analista", company: "Banco X" }) }));
    expect(campo("external.field.company").value).toBe("Banco X");
    expect(campo("external.field.appliedOn").value).toBe("2026-11-05");
    expect((campo("external.field.status") as unknown as HTMLSelectElement).value).toBe("interviewing");
    llenar({ status: "offer" });
    fireEvent.click(guardar());
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ method: "PUT", url: `/api/applications/external/${EID}` });
    expect(escritos(llamadas)[0].body).toEqual({ company_name: "Banco X", position: "Analista", applied_on: "2026-11-05", status: "offer", notes: "Hablé con RRHH, esperan al 20." });
    await waitFor(() => expect(items()[0]).toHaveTextContent(t("external.status.offer")), ESPERA);
  });
  it("«Borrar» pide confirmación; confirmar borra una sola vez y lo quita de la lista", async () => {
    const { llamadas } = backend();
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(within(items()[0]).getByRole("button", { name: tf("external.actionLabel", { action: t("external.delete"), position: "Analista", company: "Banco X" }) }));
    const d = screen.getByRole("dialog");
    expect(d).toHaveAccessibleName(t("external.delete.title"));
    expect(escritos(llamadas)).toHaveLength(0);
    dobleClic(within(d).getByRole("button", { name: t("external.delete.confirm") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), ESPERA);
    expect(escritos(llamadas)).toEqual([expect.objectContaining({ method: "DELETE", url: `/api/applications/external/${EID}` })]);
    expect(await screen.findByText(t("external.empty"), {}, ESPERA)).toBeInTheDocument();
  });
  it("si borrar falla, el diálogo sigue abierto con el error", async () => {
    backend({ cambiar: () => jsonRes(502) });
    render(<ExternalApplications />);
    await listo();
    fireEvent.click(within(items()[0]).getByRole("button", { name: new RegExp(`^${t("external.delete")}`) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("external.delete.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert", {}, ESPERA)).toHaveTextContent(t("external.delete.failed"));
  });
});
