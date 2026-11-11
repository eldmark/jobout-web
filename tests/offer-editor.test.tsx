/** /company/offers/new y /company/offers/[id]: formulario de oferta, requisitos, publicar, pausar, cerrar y borrar. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { DEPTO, EMPRESA, IDIOMA, LICENCIA, MUNI, OFERTA_DETALLE, OFF, PROF, SECTOR, SKILL } from "./helpers/company";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import OfferEditor from "@/app/_components/OfferEditor";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const cat = (id: string, name: string) => ({ id, code: name.toLowerCase(), name });
const CATALOGOS: Record<string, unknown[]> = {
  languages: [cat(IDIOMA, "Inglés")],
  professions: [cat(PROF, "Ingeniería de software")],
  "employment-sectors": [cat(SECTOR, "Tecnología")],
  "job-hierarchies": [],
  "academic-levels": [],
  states: [cat(DEPTO, "Guatemala")],
  "salary-ranges": [],
  "working-shifts": [],
  "contract-types": [],
  skills: [cat(SKILL, "Rust")],
  "driver-licenses": [cat(LICENCIA, "Tipo B")],
};
type M = (c: Llamada) => Response | undefined;

function backend(o: { oferta?: unknown; empresa?: unknown; extra?: M } = {}) {
  let actual = o.oferta ?? OFERTA_DETALLE();
  return stubFetch((c) => {
    const x = o.extra?.(c);
    if (x) return x;
    const m = c.url.match(/^\/api\/catalogs\/([^?]+)/);
    if (m) return jsonRes(200, m[1] === "cities" ? (new URL(c.url, "http://x").searchParams.get("state_id") === DEPTO ? [cat(MUNI, "Mixco")] : []) : CATALOGOS[m[1]] ?? []);
    if (c.url === "/api/company") return jsonRes(200, o.empresa ?? EMPRESA());
    if (c.url === "/api/company/offers" && c.method === "POST") return jsonRes(201, OFERTA_DETALLE({ ...(c.body as object) }));
    if (c.url === `/api/company/offers/${OFF}` && c.method === "GET") return typeof actual === "number" ? jsonRes(actual, { error: "no_encontrado" }) : jsonRes(200, actual);
    if (c.url === `/api/company/offers/${OFF}` && c.method === "PUT") {
      actual = { ...(actual as object), ...(c.body as object) };
      return jsonRes(204);
    }
    if (c.url.endsWith("/publish")) {
      actual = { ...(actual as object), status: "published", publication_date: "2026-11-12" };
      return jsonRes(200, { id: OFF, status: "published", publication_date: "2026-11-12" });
    }
    if (c.url.endsWith("/pause") || c.url.endsWith("/close") || c.method === "DELETE") return jsonRes(204);
    return jsonRes(404);
  });
}
const campo = (k: Parameters<typeof t>[0]) => screen.getByLabelText(t(k)) as HTMLInputElement;
const escritos = (ll: Llamada[]) => ll.filter((c) => c.method !== "GET");
const boton = (k: Parameters<typeof t>[0]) => screen.getByRole("button", { name: t(k) });
const catalogosListos = () => waitFor(() => expect((campo("offerForm.field.profession") as unknown as HTMLSelectElement).options.length).toBeGreaterThan(1), ESPERA);
async function existente(o: Parameters<typeof backend>[0] = {}) {
  const b = backend(o);
  render(<OfferEditor id={OFF} />);
  await screen.findByRole("heading", { level: 1, name: t("offerForm.titleEdit") }, ESPERA);
  await waitFor(() => expect(campo("offerForm.field.title").value).not.toBe(""), ESPERA);
  await catalogosListos();
  return b;
}

describe("crear una oferta", () => {
  it("un borrador solo necesita el título: envía OfferInput con lo vacío como null y va a la oferta creada", async () => {
    const { llamadas } = backend();
    render(<OfferEditor />);
    await screen.findByRole("heading", { level: 1, name: t("offerForm.titleNew") }, ESPERA);
    await catalogosListos();
    fireEvent.change(campo("offerForm.field.title"), { target: { value: "  Analista de datos " } });
    dobleClic(boton("offerForm.create"));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(`/company/offers/${OFF}`), ESPERA);
    expect(escritos(llamadas)).toHaveLength(1);
    expect(escritos(llamadas)[0].body).toMatchObject({ title: "Analista de datos", description: null, vacancies: null, is_confidential: false, state_id: null, skills: [], languages: [], driver_license_ids: [] });
    expect(escritos(llamadas)[0].body).not.toHaveProperty("status");
  });
  it("sin título válido no envía: lo marca, lo anuncia y enfoca el campo", async () => {
    const { llamadas } = backend();
    render(<OfferEditor />);
    await catalogosListos();
    fireEvent.change(campo("offerForm.field.title"), { target: { value: "AB" } });
    fireEvent.click(boton("offerForm.create"));
    expect(escritos(llamadas)).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(t("offerForm.error.summary"));
    expect(campo("offerForm.field.title")).toHaveAccessibleDescription(t("offerForm.error.title"));
    expect(campo("offerForm.field.title")).toHaveFocus();
  });
  it("el formulario se envía por POST y no hay campos de edad, género ni estado civil (OF4)", async () => {
    backend();
    const { container } = render(<OfferEditor />);
    await catalogosListos();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    expect(screen.queryByLabelText(/edad|género|genero|estado civil|foto/i)).toBeNull();
  });
  it("confidencial: aparece el aviso fijo de no poner el nombre de la empresa en el texto", async () => {
    backend();
    render(<OfferEditor />);
    await catalogosListos();
    expect(screen.queryByText(t("offerForm.confidentialNotice"))).toBeNull();
    fireEvent.click(campo("offerForm.field.confidential"));
    expect(screen.getByText(t("offerForm.confidentialNotice"))).toBeInTheDocument();
  });
  it("el municipio depende del departamento", async () => {
    const { llamadas } = backend();
    render(<OfferEditor />);
    await catalogosListos();
    expect(campo("offerForm.field.city")).toBeDisabled();
    fireEvent.change(campo("offerForm.field.state"), { target: { value: DEPTO } });
    await waitFor(() => expect(campo("offerForm.field.city")).not.toBeDisabled(), ESPERA);
    expect(llamadas.some((c) => c.url === `/api/catalogs/cities?state_id=${DEPTO}`)).toBe(true);
  });
  it("requisitos: añadir y quitar habilidades, idiomas y licencias", async () => {
    const { llamadas } = backend();
    render(<OfferEditor />);
    await catalogosListos();
    fireEvent.change(campo("offerForm.field.title"), { target: { value: "Analista de datos" } });
    fireEvent.change(campo("offerForm.skills.pick"), { target: { value: SKILL } });
    fireEvent.click(boton("offerForm.skills.add"));
    fireEvent.click(screen.getByLabelText(tf("offerForm.skills.required", { name: "Rust" })));
    fireEvent.change(screen.getByLabelText(tf("offerForm.skills.level", { name: "Rust" })), { target: { value: "advanced" } });
    fireEvent.change(campo("offerForm.languages.pick"), { target: { value: IDIOMA } });
    fireEvent.click(boton("offerForm.languages.add"));
    fireEvent.change(screen.getByLabelText(tf("offerForm.languages.level", { name: "Inglés" })), { target: { value: "basic" } });
    fireEvent.click(screen.getByLabelText("Tipo B"));
    fireEvent.click(boton("offerForm.create"));
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0].body).toMatchObject({
      skills: [{ skill_id: SKILL, is_required: false, min_level: "advanced" }],
      languages: [{ language_id: IDIOMA, min_proficiency: "basic" }],
      driver_license_ids: [LICENCIA],
    });
    cleanup();
    backend();
    render(<OfferEditor />);
    await catalogosListos();
    fireEvent.change(campo("offerForm.skills.pick"), { target: { value: SKILL } });
    fireEvent.click(boton("offerForm.skills.add"));
    fireEvent.click(screen.getByRole("button", { name: tf("offerForm.skills.remove", { name: "Rust" }) }));
    expect(screen.queryByLabelText(tf("offerForm.skills.level", { name: "Rust" }))).toBeNull();
  });
  it("429 al crear dice cuánto esperar y no pierde lo escrito", async () => {
    backend({ extra: (c) => (c.method === "POST" && c.url === "/api/company/offers" ? new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "content-type": "application/json", "retry-after": "1800" } }) : undefined) });
    render(<OfferEditor />);
    await catalogosListos();
    fireEvent.change(campo("offerForm.field.title"), { target: { value: "Analista de datos" } });
    fireEvent.click(boton("offerForm.create"));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(tf("company.error.rateLimitedIn", { wait: tf("offers.wait.minutes", { n: 30 }) }));
    expect(campo("offerForm.field.title").value).toBe("Analista de datos");
  });
});

describe("editar una oferta", () => {
  it("carga la oferta, guarda con PUT el OfferInput completo y lo anuncia; enlaza al panel con el número de aplicaciones", async () => {
    const { llamadas } = await existente({ oferta: OFERTA_DETALLE({ applications_count: 0 }) });
    expect(campo("offerForm.field.title").value).toBe("Desarrollador backend");
    expect(campo("offerForm.field.city").value).toBe(MUNI);
    fireEvent.change(campo("offerForm.field.vacancies"), { target: { value: "5" } });
    fireEvent.click(boton("offerForm.save"));
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ method: "PUT", url: `/api/company/offers/${OFF}` });
    expect(escritos(llamadas)[0].body).toMatchObject({ title: "Desarrollador backend", vacancies: 5, state_id: DEPTO, city_id: MUNI, skills: [{ skill_id: SKILL, is_required: true, min_level: "intermediate" }] });
    expect(await screen.findByText(t("offerForm.saved"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tf("companyOffers.applications", { n: 0, title: "Desarrollador backend" }) })).toHaveAttribute("href", `/company/offers/${OFF}/applications`);
  });
  it("OF7: con aplicaciones, solo descripción, horario, vacantes y fecha siguen editables; 409 oferta_con_aplicaciones se explica", async () => {
    await existente({ oferta: OFERTA_DETALLE({ status: "published", publication_date: "2026-11-12", applications_count: 2 }), extra: (c) => (c.method === "PUT" ? jsonRes(409, { error: "oferta_con_aplicaciones" }) : undefined) });
    expect(screen.getByText(t("offerForm.frozen"))).toBeInTheDocument();
    for (const k of ["title", "confidential", "state", "profession"] as const) expect(campo(`offerForm.field.${k}`), k).toBeDisabled();
    for (const k of ["description", "schedule", "vacancies", "hiringDate"] as const) expect(campo(`offerForm.field.${k}`), k).toBeEnabled();
    fireEvent.click(boton("offerForm.save"));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.offerFrozen"));
  });
  it("«confidencial» queda fijo desde la primera publicación", async () => {
    await existente({ oferta: OFERTA_DETALLE({ status: "paused", publication_date: "2026-11-12" }) });
    expect(campo("offerForm.field.confidential")).toBeDisabled();
    expect(campo("offerForm.field.confidential")).toHaveAccessibleDescription(t("offerForm.confidentialLocked"));
    expect(campo("offerForm.field.title")).toBeEnabled();
  });
  it("una oferta cerrada no se edita: todo de solo lectura y lo dice", async () => {
    await existente({ oferta: OFERTA_DETALLE({ status: "closed", publication_date: "2026-11-12", closed_at: "2026-11-20T00:00:00Z" }) });
    expect(screen.getByText(t("offerForm.closedNotice"))).toBeInTheDocument();
    expect(campo("offerForm.field.description")).toBeDisabled();
    expect(screen.queryByRole("button", { name: t("offerForm.save") })).toBeNull();
  });
  it("404: la oferta no existe o no es de tu empresa", async () => {
    backend({ oferta: 404 });
    render(<OfferEditor id={OFF} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.notFound"));
    expect(screen.getByRole("link", { name: t("offerForm.backToList") })).toHaveAttribute("href", "/company/offers");
  });
});

describe("publicar, pausar, cerrar y borrar (OF5, OF6, FC8)", () => {
  it("un borrador completo de una empresa vigente se publica una vez y queda publicado", async () => {
    const { llamadas } = await existente();
    const publicar = boton("offerForm.publish");
    expect(publicar).toBeEnabled();
    dobleClic(publicar);
    await waitFor(() => expect(screen.getByText(tf("offerForm.statusLine", { status: t("companyOffers.status.published") }))).toBeInTheDocument(), ESPERA);
    expect(escritos(llamadas).filter((c) => c.url.endsWith("/publish"))).toHaveLength(1);
    expect(screen.getByText(t("offerForm.published"))).toBeInTheDocument();
  });
  it("«Publicar» deshabilitado con el motivo: faltan datos", async () => {
    await existente({ oferta: OFERTA_DETALLE({ skills: [], description: null }) });
    const publicar = boton("offerForm.publish");
    expect(publicar).toBeDisabled();
    expect(publicar).toHaveAccessibleDescription(tf("offerForm.publish.missing", { fields: [t("offerForm.missing.description"), t("offerForm.missing.requirements")].join(", ") }));
  });
  it("«Publicar» deshabilitado con el motivo: empresa sin verificar o membresía vencida (FC8)", async () => {
    await existente({ empresa: EMPRESA({ verified: false, verified_at: null }) });
    // El estado de la empresa llega en paralelo con la oferta.
    await waitFor(() => expect(boton("offerForm.publish")).toBeDisabled(), ESPERA);
    expect(boton("offerForm.publish")).toHaveAccessibleDescription(t("company.gate.unverified.short"));
    cleanup();
    await existente({ empresa: EMPRESA({ membership: { type: "business", start_date: "2025-01-01", expiration_date: "2025-12-31", status: "expired" } }) });
    await waitFor(() => expect(boton("offerForm.publish")).toHaveAccessibleDescription(t("company.gate.expired.short")), ESPERA);
  });
  it("con cambios sin guardar, «Publicar» pide guardar primero", async () => {
    await existente();
    fireEvent.change(campo("offerForm.field.vacancies"), { target: { value: "7" } });
    expect(boton("offerForm.publish")).toBeDisabled();
    expect(boton("offerForm.publish")).toHaveAccessibleDescription(t("offerForm.publish.saveFirst"));
  });
  it("si el backend responde oferta_incompleta, lista lo que falta; 403 membresia_vencida se explica", async () => {
    let r = jsonRes(422, { error: "oferta_incompleta", fields: ["hiring_date"] });
    await existente({ extra: (c) => (c.url.endsWith("/publish") ? r : undefined) });
    fireEvent.click(boton("offerForm.publish"));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(tf("offerForm.publish.missing", { fields: t("offerForm.missing.hiring_date") }));
    r = jsonRes(403, { error: "membresia_vencida" });
    fireEvent.click(boton("offerForm.publish"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(t("company.error.expired")), ESPERA);
  });
  it("pausar una publicada; cerrar pide confirmación porque es definitivo", async () => {
    const { llamadas } = await existente({ oferta: OFERTA_DETALLE({ status: "published", publication_date: "2026-11-12" }) });
    expect(screen.queryByRole("button", { name: t("offerForm.delete") })).toBeNull();
    fireEvent.click(boton("offerForm.pause"));
    await waitFor(() => expect(screen.getByText(tf("offerForm.statusLine", { status: t("companyOffers.status.paused") }))).toBeInTheDocument(), ESPERA);
    fireEvent.click(boton("offerForm.close"));
    const d = screen.getByRole("dialog");
    expect(d).toHaveTextContent(t("offerForm.closeDialog.warning"));
    expect(escritos(llamadas).filter((c) => c.url.endsWith("/close"))).toHaveLength(0);
    fireEvent.click(within(d).getByRole("button", { name: t("offerForm.closeDialog.confirm") }));
    await waitFor(() => expect(screen.getByText(tf("offerForm.statusLine", { status: t("companyOffers.status.closed") }))).toBeInTheDocument(), ESPERA);
    expect(screen.getByText(t("offerForm.closedNotice"))).toBeInTheDocument();
  });
  it("borrar un borrador sin aplicaciones pide confirmación y vuelve a la lista", async () => {
    const { llamadas } = await existente();
    fireEvent.click(boton("offerForm.delete"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("offerForm.deleteDialog.confirm") }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/company/offers"), ESPERA);
    expect(escritos(llamadas)).toEqual([expect.objectContaining({ method: "DELETE", url: `/api/company/offers/${OFF}` })]);
  });
});
