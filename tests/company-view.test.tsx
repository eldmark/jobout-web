/** /company: crear la empresa o aceptar una invitación; estado (FC8), datos, reclutadores e invitaciones. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { CID, EMPRESA, INVITACION, PAIS, RECLUTADOR, REC, SECTOR, TOKEN, VIGENTE } from "./helpers/company";
import { HOSTIL } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import CompanyView from "@/app/_components/CompanyView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const pagina = <T,>(items: T[]) => ({ items, next_cursor: null });
type M = (c: Llamada) => Response | undefined;

/** Backend simulado. `empresa` es la respuesta de GET /api/company (número = estado de error). */
function backend(empresa: unknown, extra: M = () => undefined) {
  let actual = empresa;
  const r = stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.url === "/api/catalogs/countries") return jsonRes(200, [{ id: PAIS, code: "GT", name: "Guatemala" }]);
    if (c.url === "/api/catalogs/employment-sectors") return jsonRes(200, [{ id: SECTOR, code: "food", name: "Alimentos" }]);
    if (c.url === "/api/company" && c.method === "GET") return typeof actual === "number" ? jsonRes(actual, { error: "no_encontrado" }) : jsonRes(200, actual);
    if (c.url === "/api/company" && c.method === "POST") {
      actual = EMPRESA({ ...(c.body as object), verified: false, verified_at: null, membership: null });
      return jsonRes(201, actual);
    }
    if (c.url === "/api/company" && c.method === "PUT") return jsonRes(204);
    if (c.url.startsWith("/api/company/recruiters") && c.method === "GET") return jsonRes(200, pagina([RECLUTADOR({ id: "r-admin", display_name: "Ana P.", role: "company_admin" }), RECLUTADOR()]));
    if (c.url.startsWith("/api/company/invitations") && c.method === "GET") return jsonRes(200, pagina([INVITACION()]));
    if (c.url === "/api/company/invitations" && c.method === "POST") return jsonRes(201, INVITACION({ id: "inv-2", token: TOKEN }));
    if (c.method === "DELETE") return jsonRes(204);
    if (c.url === "/api/invitations/accept") {
      actual = EMPRESA({ my_role: "recruiter" });
      return jsonRes(200, { company: { id: CID, name: "Café Nuevo S.A." }, role: "recruiter" });
    }
    return jsonRes(404);
  });
  return r;
}
const titulo = () => screen.findByRole("heading", { level: 1, name: t("company.title") }, ESPERA);
const campo = (k: Parameters<typeof t>[0]) => screen.getByLabelText(t(k)) as HTMLInputElement;
const escritos = (ll: Llamada[]) => ll.filter((c) => c.method !== "GET");

async function sinEmpresa() {
  const b = backend(404);
  render(<CompanyView />);
  await screen.findByText(t("company.none.lead"), {}, ESPERA);
  await waitFor(() => expect((campo("companyForm.field.country") as unknown as HTMLSelectElement).options.length).toBeGreaterThan(1), ESPERA);
  return b;
}
function llenarEmpresa() {
  fireEvent.change(campo("companyForm.field.name"), { target: { value: " Café Nuevo S.A. " } });
  fireEvent.change(campo("companyForm.field.taxId"), { target: { value: "1234567-8" } });
  fireEvent.change(campo("companyForm.field.website"), { target: { value: "https://cafenuevo.example" } });
  fireEvent.change(campo("companyForm.field.country"), { target: { value: PAIS } });
  fireEvent.change(campo("companyForm.field.sector"), { target: { value: SECTOR } });
}

describe("sin empresa (un candidato que abre /company ve qué puede hacer)", () => {
  it("lo explica y ofrece crear la empresa o aceptar una invitación, ambos por POST", async () => {
    await sinEmpresa();
    expect(screen.getByRole("heading", { name: t("companyForm.titleNew") })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("company.accept.title") })).toBeInTheDocument();
    for (const f of document.querySelectorAll("form")) expect(f).toHaveAttribute("method", "post");
  });
  it("crear: envía una vez solo CompanyInput (vacíos como null) y muestra «En verificación» con qué hacer (FC8)", async () => {
    const { llamadas } = await sinEmpresa();
    llenarEmpresa();
    dobleClic(screen.getByRole("button", { name: t("companyForm.create") }));
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ method: "POST", url: "/api/company" });
    expect(escritos(llamadas)[0].body).toEqual({ name: "Café Nuevo S.A.", tax_id: "1234567-8", website: "https://cafenuevo.example", phone: null, description: null, country_id: PAIS, employment_sector_id: SECTOR });
    const aviso = await screen.findByRole("heading", { name: t("company.gate.unverified.title") }, ESPERA);
    expect(aviso.closest("section")).toHaveTextContent(t("company.gate.unverified.body"));
  });
  it("sin datos válidos no envía: marca los campos, lo anuncia y enfoca el primero", async () => {
    const { llamadas } = await sinEmpresa();
    fireEvent.change(campo("companyForm.field.website"), { target: { value: "http://sin-https.example" } });
    fireEvent.click(screen.getByRole("button", { name: t("companyForm.create") }));
    expect(escritos(llamadas)).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(t("companyForm.error.summary"));
    expect(campo("companyForm.field.name")).toHaveAttribute("aria-invalid", "true");
    expect(campo("companyForm.field.website")).toHaveAccessibleDescription(expect.stringContaining(t("companyForm.error.website")));
    expect(campo("companyForm.field.name")).toHaveFocus();
  });
  for (const [codigo, clave] of [["ya_tiene_empresa", "company.error.alreadyMember"], ["empresa_duplicada", "company.error.duplicate"]] as const) {
    it(`409 ${codigo} se explica sin perder lo escrito`, async () => {
      backend(404, (c) => (c.method === "POST" && c.url === "/api/company" ? jsonRes(409, { error: codigo }) : undefined));
      render(<CompanyView />);
      await screen.findByText(t("company.none.lead"), {}, ESPERA);
      await waitFor(() => expect((campo("companyForm.field.country") as unknown as HTMLSelectElement).options.length).toBeGreaterThan(1), ESPERA);
      llenarEmpresa();
      fireEvent.click(screen.getByRole("button", { name: t("companyForm.create") }));
      expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t(clave));
      expect(campo("companyForm.field.taxId").value).toBe("1234567-8");
    });
  }
  it("aceptar una invitación: envía solo el código y muestra la empresa; un código inválido se explica", async () => {
    const { llamadas } = await sinEmpresa();
    fireEvent.change(campo("company.accept.token"), { target: { value: `  ${TOKEN} ` } });
    fireEvent.click(screen.getByRole("button", { name: t("company.accept.submit") }));
    await titulo();
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ url: "/api/invitations/accept", body: { token: TOKEN } });
    cleanup();
    backend(404, (c) => (c.url === "/api/invitations/accept" ? jsonRes(404, { error: "invitacion_invalida" }) : undefined));
    render(<CompanyView />);
    await screen.findByText(t("company.none.lead"), {}, ESPERA);
    fireEvent.change(campo("company.accept.token"), { target: { value: "otro-codigo" } });
    fireEvent.click(screen.getByRole("button", { name: t("company.accept.submit") }));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.invitation"));
  });
});

describe("con empresa", () => {
  it("cargando y luego los datos; con HTML se pintan como texto (SX7)", async () => {
    backend(EMPRESA({ description: HOSTIL }));
    render(<CompanyView />);
    expect(screen.getByRole("status")).toHaveTextContent(t("company.loading"));
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("1234567-8");
    expect(main).toHaveTextContent("<b>negrita</b>");
    expect(main.querySelector("img, script, b")).toBeNull();
    expect(screen.getByRole("link", { name: t("company.toOffers") })).toHaveAttribute("href", "/company/offers");
  });
  it("FC8: verificada y vigente, sin avisos; sin membresía o vencida, cada una con qué hacer", async () => {
    backend(EMPRESA());
    render(<CompanyView />);
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    for (const k of ["unverified", "noMembership", "expired"]) expect(screen.queryByRole("heading", { name: t(`company.gate.${k}.title` as never) })).toBeNull();
    for (const [over, k] of [[{ membership: null }, "noMembership"], [{ membership: { ...VIGENTE, status: "expired" } }, "expired"]] as const) {
      cleanup();
      backend(EMPRESA(over));
      render(<CompanyView />);
      const h = await screen.findByRole("heading", { name: t(`company.gate.${k}.title` as never) }, ESPERA);
      expect(h.closest("section")).toHaveTextContent(t(`company.gate.${k}.body` as never));
    }
  });
  it("un reclutador (no admin) no ve editar, el equipo ni las invitaciones", async () => {
    const { llamadas } = backend(EMPRESA({ my_role: "recruiter" }));
    render(<CompanyView />);
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    expect(screen.queryByRole("button", { name: t("company.edit") })).toBeNull();
    expect(screen.queryByRole("heading", { name: t("company.team.title") })).toBeNull();
    expect(screen.queryByRole("heading", { name: t("company.invite.title") })).toBeNull();
    expect(llamadas.some((c) => c.url.includes("recruiters") || c.url.includes("invitations"))).toBe(false);
  });
  it("editar: PUT con CompanyInput completo; 409 nit_inmutable se explica", async () => {
    let r = jsonRes(204);
    const { llamadas } = backend(EMPRESA(), (c) => (c.method === "PUT" ? r : undefined));
    render(<CompanyView />);
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    fireEvent.click(screen.getByRole("button", { name: t("company.edit") }));
    await waitFor(() => expect(campo("companyForm.field.name").value).toBe("Café Nuevo S.A."), ESPERA);
    fireEvent.change(campo("companyForm.field.phone"), { target: { value: "+502 4444 0000" } });
    fireEvent.click(screen.getByRole("button", { name: t("companyForm.save") }));
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0].body).toEqual({ name: "Café Nuevo S.A.", tax_id: "1234567-8", website: "https://cafenuevo.example", phone: "+502 4444 0000", description: "Tostamos y vendemos café.", country_id: PAIS, employment_sector_id: SECTOR });
    expect(await screen.findByText(t("companyForm.saved"), {}, ESPERA)).toBeInTheDocument();
    r = jsonRes(409, { error: "nit_inmutable" });
    fireEvent.click(screen.getByRole("button", { name: t("company.edit") }));
    fireEvent.click(screen.getByRole("button", { name: t("companyForm.save") }));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.taxIdLocked"));
  });
  it("equipo: lista nombre y rol; quitar pide confirmación; 409 ultimo_administrador se explica", async () => {
    let r = jsonRes(204);
    const { llamadas } = backend(EMPRESA(), (c) => (c.method === "DELETE" && c.url.includes("recruiters") ? r : undefined));
    render(<CompanyView />);
    const equipo = (await screen.findByRole("heading", { name: t("company.team.title") }, ESPERA)).closest("section")!;
    await within(equipo as HTMLElement).findByText("Luis E.", {}, ESPERA);
    expect(equipo).toHaveTextContent(t("company.role.company_admin"));
    expect(equipo).toHaveTextContent(t("company.role.recruiter"));
    fireEvent.click(within(equipo as HTMLElement).getByRole("button", { name: tf("company.team.removeLabel", { name: "Luis E." }) }));
    expect(escritos(llamadas)).toHaveLength(0);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("company.team.remove.confirm") }));
    await waitFor(() => expect(escritos(llamadas)).toEqual([expect.objectContaining({ method: "DELETE", url: `/api/company/recruiters/${REC}` })]), ESPERA);
    await waitFor(() => expect(within(equipo as HTMLElement).queryByText("Luis E.")).toBeNull(), ESPERA);
    r = jsonRes(409, { error: "ultimo_administrador" });
    fireEvent.click(within(equipo as HTMLElement).getByRole("button", { name: tf("company.team.removeLabel", { name: "Ana P." }) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("company.team.remove.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.error.lastAdmin"));
  });
  it("invitar: el código se muestra UNA vez, con «Copiar»; la lista nunca lo muestra; revocar pide confirmación", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { llamadas } = backend(EMPRESA());
    render(<CompanyView />);
    const seccion = (await screen.findByRole("heading", { name: t("company.invite.title") }, ESPERA)).closest("section") as HTMLElement;
    fireEvent.change(within(seccion).getByLabelText(t("company.invite.email")), { target: { value: "luis@example.test" } });
    fireEvent.change(within(seccion).getByLabelText(t("company.invite.role")), { target: { value: "company_admin" } });
    fireEvent.click(within(seccion).getByRole("button", { name: t("company.invite.submit") }));
    await within(seccion).findByText(TOKEN, {}, ESPERA);
    expect(escritos(llamadas)[0].body).toEqual({ email: "luis@example.test", role: "company_admin" });
    expect(seccion).toHaveTextContent(t("company.invite.tokenOnce"));
    fireEvent.click(within(seccion).getByRole("button", { name: t("company.invite.copy") }));
    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(await within(seccion).findByText(t("company.invite.copied"), {}, ESPERA)).toBeInTheDocument();
    fireEvent.click(within(seccion).getByRole("button", { name: t("company.invite.done") }));
    expect(within(seccion).queryByText(TOKEN)).toBeNull();
    expect(seccion).toHaveTextContent(t("company.invitation.status.pending"));
    fireEvent.click(within(seccion).getAllByRole("button", { name: new RegExp(`^${t("company.invite.revoke")}`) })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("company.invite.revokeConfirm") }));
    await waitFor(() => expect(escritos(llamadas).some((c) => c.method === "DELETE" && c.url.startsWith("/api/company/invitations/"))).toBe(true), ESPERA);
  });
  it("una invitación con un rol que no es recruiter ni company_admin no se puede elegir", async () => {
    backend(EMPRESA());
    render(<CompanyView />);
    const seccion = (await screen.findByRole("heading", { name: t("company.invite.title") }, ESPERA)).closest("section") as HTMLElement;
    const rol = within(seccion).getByLabelText(t("company.invite.role")) as HTMLSelectElement;
    expect([...rol.options].map((o) => o.value)).toEqual(["recruiter", "company_admin"]);
  });
});

describe("errores al cargar", () => {
  it("un fallo se anuncia y deja reintentar; un 401 lleva a /sign-in", async () => {
    let falla = true;
    backend(EMPRESA(), (c) => (falla && c.url === "/api/company" ? jsonRes(502) : undefined));
    render(<CompanyView />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("company.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("company.retry") }));
    await screen.findByText("Café Nuevo S.A.", {}, ESPERA);
    cleanup();
    backend(EMPRESA(), (c) => (c.url === "/api/company" ? jsonRes(401) : undefined));
    render(<CompanyView />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
  });
  it("una sola h1", async () => {
    backend(EMPRESA());
    render(<CompanyView />);
    await titulo();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
