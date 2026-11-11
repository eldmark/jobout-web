/** /admin/companies: la cola de empresas por verificar, verificar o quitar la verificación y la membresía. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { CID, EMPRESA_ADMIN } from "./helpers/company";
import { HOSTIL } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import AdminCompanies from "@/app/_components/AdminCompanies";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

type M = (c: Llamada) => Response | undefined;
const consulta = (c: Llamada) => new URL(c.url, "http://x").searchParams;
function backend(extra: M = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.url.startsWith("/api/admin/companies?") || c.url === "/api/admin/companies") {
      const verificadas = consulta(c).get("verified") === "true";
      return jsonRes(200, { items: [EMPRESA_ADMIN(verificadas ? { verified_at: "2026-11-02T10:00:00.000000Z" } : {})], next_cursor: null });
    }
    return jsonRes(204);
  });
}
const listo = () => screen.findByRole("list", { name: t("admin.listLabel") }, ESPERA);
/** Las filas de la lista; sin filas, la lista no se pinta (se ve el vacío). */
const filas = () => {
  const lista = screen.queryByRole("list", { name: t("admin.listLabel") });
  return lista ? within(lista).queryAllByRole("listitem") : [];
};
const escritos = (ll: Llamada[]) => ll.filter((c) => c.method !== "GET");
const accion = (k: Parameters<typeof t>[0]) => screen.getByRole("button", { name: tf("admin.actionLabel", { action: t(k), name: "Café Nuevo S.A." }) });

describe("cola por verificar", () => {
  it("por defecto pide las no verificadas; cada una con NIT, sitio, dominio del creador y reclutadores", async () => {
    const { llamadas } = backend();
    render(<AdminCompanies />);
    await listo();
    expect(Object.fromEntries(consulta(llamadas[0]))).toEqual({ verified: "false", limit: "20" });
    const [f] = filas();
    expect(f).not.toHaveTextContent("(opcional)");
    for (const texto of ["Café Nuevo S.A.", "1234567-8", "https://cafenuevo.example", tf("admin.domain", { domain: "cafenuevo.example" }), tf("admin.recruiters", { n: 1 })]) expect(f, texto).toHaveTextContent(texto);
  });
  it("verificar llama una vez, la quita de la cola y lo anuncia", async () => {
    const { llamadas } = backend();
    render(<AdminCompanies />);
    await listo();
    dobleClic(accion("admin.verify"));
    await waitFor(() => expect(filas()).toHaveLength(0), ESPERA);
    expect(escritos(llamadas)).toEqual([expect.objectContaining({ method: "POST", url: `/api/admin/companies/${CID}/verify` })]);
    expect(screen.getByText(t("admin.verifiedDone"))).toBeInTheDocument();
  });
  it("403 al verificar (el admin es de esa empresa) se explica", async () => {
    backend((c) => (c.url.endsWith("/verify") ? jsonRes(403, { error: "sin_permiso" }) : undefined));
    render(<AdminCompanies />);
    await listo();
    fireEvent.click(accion("admin.verify"));
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("admin.error.ownCompany"));
  });
  it("SX7: el nombre de la empresa se pinta como texto", async () => {
    backend((c) => (c.method === "GET" ? jsonRes(200, { items: [EMPRESA_ADMIN({ name: HOSTIL })], next_cursor: null }) : undefined));
    render(<AdminCompanies />);
    await listo();
    expect(filas()[0].querySelector("img, script, b")).toBeNull();
  });
});

describe("verificadas", () => {
  it("cambiar a «Verificadas» pide verified=true; quitar la verificación pide confirmación y explica el efecto", async () => {
    const { llamadas } = backend();
    const { container } = render(<AdminCompanies />);
    await listo();
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    fireEvent.change(screen.getByLabelText(t("admin.filter.label")), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: t("admin.filter.apply") }));
    await waitFor(() => expect(consulta(llamadas.filter((c) => c.method === "GET").at(-1)!).get("verified")).toBe("true"), ESPERA);
    await waitFor(() => expect(accion("admin.unverify")).toBeInTheDocument(), ESPERA);
    fireEvent.click(accion("admin.unverify"));
    const d = screen.getByRole("dialog");
    expect(d).toHaveTextContent(t("admin.unverifyDialog.warning"));
    expect(escritos(llamadas)).toHaveLength(0);
    fireEvent.click(within(d).getByRole("button", { name: t("admin.unverifyDialog.confirm") }));
    await waitFor(() => expect(escritos(llamadas)).toEqual([expect.objectContaining({ method: "POST", url: `/api/admin/companies/${CID}/unverify` })]), ESPERA);
  });
});

describe("membresía", () => {
  it("guarda con PUT {membership_type: business, start_date, expiration_date}", async () => {
    const { llamadas } = backend();
    render(<AdminCompanies />);
    await listo();
    const f = filas()[0];
    fireEvent.change(within(f).getByLabelText(t("admin.membership.start")), { target: { value: "2026-11-01" } });
    fireEvent.change(within(f).getByLabelText(t("admin.membership.end")), { target: { value: "2027-11-01" } });
    fireEvent.click(within(f).getByRole("button", { name: tf("admin.actionLabel", { action: t("admin.membership.save"), name: "Café Nuevo S.A." }) }));
    await waitFor(() => expect(escritos(llamadas)).toHaveLength(1), ESPERA);
    expect(escritos(llamadas)[0]).toMatchObject({ method: "PUT", url: `/api/admin/companies/${CID}/membership`, body: { membership_type: "business", start_date: "2026-11-01", expiration_date: "2027-11-01" } });
    expect(await within(f).findByText(t("admin.membership.saved"), {}, ESPERA)).toBeInTheDocument();
  });
  it("fechas fuera de rango no se envían y se explica por qué", async () => {
    const { llamadas } = backend();
    render(<AdminCompanies />);
    await listo();
    const f = filas()[0];
    fireEvent.change(within(f).getByLabelText(t("admin.membership.start")), { target: { value: "2026-11-01" } });
    fireEvent.change(within(f).getByLabelText(t("admin.membership.end")), { target: { value: "2026-10-01" } });
    fireEvent.click(within(f).getByRole("button", { name: tf("admin.actionLabel", { action: t("admin.membership.save"), name: "Café Nuevo S.A." }) }));
    expect(within(f).getByRole("alert")).toHaveTextContent(t("admin.membership.error"));
    expect(escritos(llamadas)).toHaveLength(0);
  });
});

describe("acceso y estados", () => {
  it("quien no es admin de plataforma (403 sin_permiso) ve una explicación, no la lista", async () => {
    backend((c) => (c.method === "GET" ? jsonRes(403, { error: "sin_permiso" }) : undefined));
    render(<AdminCompanies />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("admin.error.noPermission"));
    expect(screen.queryByRole("list", { name: t("admin.listLabel") })).toBeNull();
  });
  it("vacío: lo dice; una sola h1", async () => {
    backend((c) => (c.method === "GET" ? jsonRes(200, { items: [], next_cursor: null }) : undefined));
    render(<AdminCompanies />);
    expect(await screen.findByText(t("admin.empty"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
