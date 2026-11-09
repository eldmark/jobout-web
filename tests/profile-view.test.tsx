/** Perfil: ver/editar, lista de CVs, borrado con confirmación (F10, F14). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { CV_ID, catalogoPorUrl } from "./helpers/cv";
import { t } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import ProfileView from "@/app/_components/ProfileView";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const OTRO = "22222222-2222-4222-8222-222222222222";
const PERFIL = {
  description: "Me gusta el backend",
  phone: "+57 300 123",
  academic_level_id: "a-1",
  profession_id: "p-1",
  job_hierarchy_id: null,
  skills: [{ skill_id: "s-rust", level: "advanced", years_of_experience: 3 }],
  languages: [{ language_id: "l-en", proficiency: "basic" }],
  experiences: [{ company: "Acme", title: "Dev", start_date: "2021-01-01", end_date: null, description: null }],
  extra_knowledge: null,
};
const CVS = [
  { id: CV_ID, version: 2, is_primary: true, original_filename: "nuevo.pdf", size_bytes: 2048, created_at: "2026-11-05T10:00:00Z" },
  { id: OTRO, version: 1, is_primary: false, original_filename: "viejo.pdf", size_bytes: 1024, created_at: "2026-10-05T10:00:00Z" },
];

function backend(over: { perfil?: unknown; cvs?: unknown; fallo?: (c: Llamada) => Response | null } = {}) {
  let cvs = over.cvs ?? CVS;
  return stubFetch((c) => {
    const f = over.fallo?.(c);
    if (f) return f;
    const cat = catalogoPorUrl(c.url);
    if (cat) return cat;
    if (c.url === "/api/profile" && c.method === "GET") return jsonRes(200, over.perfil ?? PERFIL);
    if (c.url === "/api/profile" && c.method === "PUT") return jsonRes(204);
    if (c.url === "/api/cvs" && c.method === "GET") return jsonRes(200, cvs);
    if (c.method === "DELETE") {
      cvs = (cvs as typeof CVS).filter((x) => !c.url.includes(x.id));
      return jsonRes(204);
    }
    return jsonRes(204);
  });
}
const cargado = () => screen.findByRole("heading", { level: 1, name: t("profile.title") });
const borrarDe = (nombre: string) => within(screen.getByText(nombre).closest("li")!).getByRole("button", { name: new RegExp(t("profile.cv.delete")) });

describe("estados de la pantalla", () => {
  it("cargando y luego muestra el perfil", async () => {
    backend();
    render(<ProfileView />);
    expect(screen.getByRole("status")).toHaveTextContent(t("profile.loading"));
    await cargado();
    expect(screen.getByLabelText(t("form.description"))).toHaveValue("Me gusta el backend");
    expect(screen.getByLabelText(t("form.phone"))).toHaveValue("+57 300 123");
    expect(screen.getByLabelText(t("form.academic"))).toHaveValue("a-1");
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getByLabelText(t("form.exp.company"))).toHaveValue("Acme");
  });
  it("error: avisa en español y permite reintentar", async () => {
    let falla = true;
    backend({ fallo: (c) => (falla && c.url === "/api/profile" ? jsonRes(502, { error: "servicio_no_disponible" }) : null) });
    render(<ProfileView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(t("profile.error"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("profile.retry") }));
    await cargado();
  });
  it("vacío: sin CVs invita a subir uno", async () => {
    backend({ cvs: [] });
    render(<ProfileView />);
    await cargado();
    expect(screen.getByText(t("profile.cvs.empty"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("profile.cvs.upload") })).toHaveAttribute("href", "/profile/cv");
  });
  it("401 lleva a /sign-in", async () => {
    backend({ fallo: (c) => (c.url === "/api/profile" ? jsonRes(401, { error: "sesion_expirada" }) : null) });
    render(<ProfileView />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"));
  });
});

describe("editar el perfil", () => {
  it("guarda el perfil completo con un PUT", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    fireEvent.change(screen.getByLabelText(t("form.description")), { target: { value: "Nueva" } });
    fireEvent.change(screen.getByLabelText(t("form.hierarchy")), { target: { value: "j-1" } });
    fireEvent.click(screen.getByRole("button", { name: t("profile.save") }));
    expect(await screen.findByText(t("profile.saved"))).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(t("profile.saved"));
    const put = llamadas.filter((c) => c.method === "PUT" && c.url === "/api/profile");
    expect(put).toHaveLength(1);
    expect(put[0].body).toEqual({
      description: "Nueva",
      phone: "+57 300 123",
      academic_level_id: "a-1",
      profession_id: "p-1",
      job_hierarchy_id: "j-1",
      skills: [{ skill_id: "s-rust", level: "advanced", years_of_experience: 3 }],
      languages: [{ language_id: "l-en", proficiency: "basic" }],
      experiences: [{ company: "Acme", title: "Dev", start_date: "2021-01-01", end_date: null, description: null }],
    });
  });
  it("teléfono inválido: no llama a la API y enfoca el campo", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    const tel = screen.getByLabelText(t("form.phone"));
    fireEvent.change(tel, { target: { value: "llámame" } });
    fireEvent.click(screen.getByRole("button", { name: t("profile.save") }));
    expect(tel).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(tel);
    expect(llamadas.some((c) => c.method === "PUT")).toBe(false);
  });
  it("422 al guardar: mensaje en español", async () => {
    backend({ fallo: (c) => (c.method === "PUT" && c.url === "/api/profile" ? jsonRes(422, { error: "datos_invalidos" }) : null) });
    render(<ProfileView />);
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: t("profile.save") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t("cv.error.invalid"));
  });
  it("doble clic en guardar envía una sola vez", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    const b = screen.getByRole("button", { name: t("profile.save") });
    fireEvent.click(b);
    fireEvent.click(b);
    await screen.findByText(t("profile.saved"));
    expect(llamadas.filter((c) => c.method === "PUT")).toHaveLength(1);
  });
});

describe("lista de CVs", () => {
  it("muestra versión, nombre, primario y descarga por la capa servidor", async () => {
    backend();
    render(<ProfileView />);
    await cargado();
    const fila = screen.getByText("nuevo.pdf").closest("li")!;
    expect(within(fila).getByText(t("profile.cv.primary"))).toBeInTheDocument();
    const enlace = within(fila).getByRole("link", { name: new RegExp(t("profile.cv.download")) });
    expect(enlace).toHaveAttribute("href", `/api/cvs/${CV_ID}/file`);
    expect(enlace).toHaveAttribute("download");
    expect(within(fila).queryByRole("button", { name: new RegExp(t("profile.cv.makePrimary")) })).toBeNull();
  });
  it("marcar como primario llama a PUT y recarga la lista", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    const fila = screen.getByText("viejo.pdf").closest("li")!;
    fireEvent.click(within(fila).getByRole("button", { name: new RegExp(t("profile.cv.makePrimary")) }));
    await waitFor(() => expect(llamadas.some((c) => c.method === "PUT" && c.url === `/api/cvs/${OTRO}/primary`)).toBe(true));
  });
});

describe("F10 borrar un CV", () => {
  it("el primer clic abre el diálogo y NO llama a la API", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    fireEvent.click(borrarDe("viejo.pdf"));
    const dlg = screen.getByRole("dialog");
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(dlg).toHaveAccessibleName(t("cv.delete.title"));
    expect(dlg).toHaveTextContent(t("cv.delete.lossFile"));
    expect(dlg).toHaveTextContent(t("cv.delete.lossExtraction"));
    expect(dlg).toHaveTextContent(t("cv.delete.irreversible"));
    expect(llamadas.some((c) => c.method === "DELETE")).toBe(false);
  });
  it("cancelar cierra sin borrar y devuelve el foco; Escape también", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    const disparador = borrarDe("viejo.pdf");
    disparador.focus();
    fireEvent.click(disparador);
    fireEvent.click(screen.getByRole("button", { name: t("cv.delete.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(disparador);
    fireEvent.click(disparador);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(llamadas.some((c) => c.method === "DELETE")).toBe(false);
  });
  it("atrapa el foco: Tab desde el último va al primero y Shift+Tab al revés", async () => {
    backend();
    render(<ProfileView />);
    await cargado();
    fireEvent.click(borrarDe("viejo.pdf"));
    const dlg = screen.getByRole("dialog");
    const cancelar = within(dlg).getByRole("button", { name: t("cv.delete.cancel") });
    const borrar = within(dlg).getByRole("button", { name: t("cv.delete.confirm") });
    expect(document.activeElement).toBe(cancelar);
    borrar.focus();
    fireEvent.keyDown(dlg, { key: "Tab" });
    expect(document.activeElement).toBe(cancelar);
    fireEvent.keyDown(dlg, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(borrar);
  });
  it("confirmar borra una sola vez (doble clic) y la lista se actualiza", async () => {
    const { llamadas } = backend();
    render(<ProfileView />);
    await cargado();
    fireEvent.click(borrarDe("viejo.pdf"));
    const ok = screen.getByRole("button", { name: t("cv.delete.confirm") });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(screen.queryByText("viejo.pdf")).toBeNull());
    expect(llamadas.filter((c) => c.method === "DELETE")).toHaveLength(1);
    expect(llamadas.find((c) => c.method === "DELETE")!.url).toBe(`/api/cvs/${OTRO}`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("si falla, el diálogo sigue abierto con un aviso en español", async () => {
    backend({ fallo: (c) => (c.method === "DELETE" ? jsonRes(502, { error: "servicio_no_disponible" }) : null) });
    render(<ProfileView />);
    await cargado();
    fireEvent.click(borrarDe("viejo.pdf"));
    fireEvent.click(screen.getByRole("button", { name: t("cv.delete.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(t("cv.delete.failed"));
    expect(screen.getByText("viejo.pdf")).toBeInTheDocument();
  });
});
