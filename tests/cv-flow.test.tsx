/** F2–F9 y F14: subir el CV, revisar lo propuesto y confirmar. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { CREADO, CV_ID, FakeXHR, PDF, archivo, catalogoPorUrl } from "./helpers/cv";
import { t } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import CvFlow from "@/app/_components/CvFlow";
import { alertaCon } from "./helpers/alerta";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

beforeEach(() => {
  FakeXHR.instancias = [];
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const CONFIRM_URL = `/api/cvs/${CV_ID}/extraction/confirm`;

function backend(extra?: (c: { url: string; method: string }) => Response | null) {
  return stubFetch((c) => extra?.(c) ?? catalogoPorUrl(c.url) ?? jsonRes(204));
}
function elegir(f: File) {
  fireEvent.change(screen.getByLabelText(t("cv.upload.fileLabel")), { target: { files: [f] } });
}
async function subirYRevisar(extraction?: unknown) {
  render(<CvFlow />);
  elegir(PDF());
  fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
  FakeXHR.last.terminar(201, CREADO(extraction));
}
const revisar = async () => screen.findByRole("heading", { name: t("review.title") });

describe("F2 selector de archivo", () => {
  it("solo acepta PDF y DOCX en el selector", () => {
    backend();
    render(<CvFlow />);
    const accept = screen.getByLabelText(t("cv.upload.fileLabel")).getAttribute("accept")!;
    expect(accept).toContain(".pdf");
    expect(accept).toContain(".docx");
    expect(accept).not.toContain("image");
  });
  it("rechaza más de 5 MB ANTES de enviar, con mensaje claro", () => {
    backend();
    render(<CvFlow />);
    elegir(archivo("cv.pdf", "application/pdf", 5 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent(t("cv.error.tooBig"));
    expect(screen.getByRole("button", { name: t("cv.upload.submit") })).toBeDisabled();
    expect(FakeXHR.instancias).toHaveLength(0);
  });
  it("rechaza un tipo que no es PDF ni DOCX", () => {
    backend();
    render(<CvFlow />);
    elegir(archivo("foto.png", "image/png"));
    expect(screen.getByRole("alert")).toHaveTextContent(t("cv.error.badType"));
    expect(FakeXHR.instancias).toHaveLength(0);
  });
  it("sin archivo no hay subida posible", () => {
    backend();
    render(<CvFlow />);
    expect(screen.getByRole("button", { name: t("cv.upload.submit") })).toBeDisabled();
  });
});

describe("F3 progreso y botón deshabilitado", () => {
  it("muestra el progreso, deshabilita el botón y no sube dos veces", () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    const boton = screen.getByRole("button", { name: t("cv.upload.submit") });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(FakeXHR.instancias).toHaveLength(1);
    expect(FakeXHR.last).toMatchObject({ method: "POST", url: "/api/cvs" });
    expect((FakeXHR.last.body as FormData).get("file")).toBeInstanceOf(File);
    FakeXHR.last.progreso(50, 100);
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
    expect(screen.getByRole("button", { name: t("cv.upload.uploading") })).toBeDisabled();
  });
  it("tras un error el botón se habilita otra vez", async () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    FakeXHR.last.fallarRed();
    await alertaCon(t("cv.error.network"));
    expect(screen.getByRole("button", { name: t("cv.upload.submit") })).toBeEnabled();
  });
});

describe("F4 lo propuesto, agrupado con su confianza", () => {
  it("agrupa en experiencia, habilidades e idiomas y destaca la confianza baja", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    for (const k of ["form.group.experience", "form.group.skills", "form.group.languages"] as const) {
      expect(screen.getByRole("heading", { name: t(k) })).toBeInTheDocument();
    }
    const sql = screen.getByText("SQL").closest("li")!;
    expect(sql).toHaveAttribute("data-destacado", "true");
    expect(within(sql).getByText(t("confidence.baja"))).toBeInTheDocument();
    const rust = screen.getByText("Rust").closest("li")!;
    expect(rust).not.toHaveAttribute("data-destacado", "true");
    expect(within(rust).getByText(t("confidence.alta"))).toBeInTheDocument();
    expect(screen.getByText(t("confidence.media"))).toBeInTheDocument();
    expect(screen.getByLabelText(t("form.exp.company"))).toHaveValue("Acme");
  });
  it("el idioma «a confirmar» se avisa", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    expect(screen.getByText(t("review.toConfirm"))).toBeInTheDocument();
  });
});

describe("F5 editar, quitar y añadir; nada se guarda hasta Confirmar", () => {
  it("lo editado es lo que se envía, y no antes", async () => {
    const { llamadas } = backend();
    await subirYRevisar();
    await revisar();
    fireEvent.change(screen.getByLabelText(t("form.exp.company")), { target: { value: "Globex" } });
    fireEvent.click(screen.getByRole("button", { name: `${t("form.skill.remove")} SQL` }));
    fireEvent.change(screen.getByLabelText(t("form.skill.search")), { target: { value: "dock" } });
    fireEvent.click(screen.getByRole("button", { name: `${t("form.skill.add")} Docker` }));
    fireEvent.click(screen.getByRole("button", { name: t("form.language.add") }));
    expect(llamadas.some((c) => c.method !== "GET")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: t("review.confirm") }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/profile"));
    const confirm = llamadas.filter((c) => c.url === CONFIRM_URL);
    expect(confirm).toHaveLength(1);
    const cuerpo = confirm[0].body as Record<string, unknown>;
    expect(cuerpo.skills).toEqual([
      { skill_id: "s-rust", level: null },
      { skill_id: "s-docker", level: null },
    ]);
    expect((cuerpo.experiences as Array<{ company: string }>)[0].company).toBe("Globex");
    expect(cuerpo.description).toBe("Desarrollo backend");
    expect(cuerpo).not.toHaveProperty("phone");
    expect(cuerpo.languages).toEqual([{ language_id: "l-en", proficiency: "advanced" }]);
  });
  it("se puede añadir una experiencia nueva", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    fireEvent.click(screen.getByRole("button", { name: t("form.exp.add") }));
    expect(screen.getAllByLabelText(t("form.exp.company"))).toHaveLength(2);
  });
});

describe("F6 skills solo del catálogo", () => {
  it("sugiere desde el catálogo y no permite inventar", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    const buscar = screen.getByLabelText(t("form.skill.search"));
    fireEvent.change(buscar, { target: { value: "rea" } });
    expect(screen.getByRole("button", { name: `${t("form.skill.add")} React` })).toBeInTheDocument();
    fireEvent.change(buscar, { target: { value: "Inventada" } });
    expect(screen.getByText(t("form.skill.none"))).toBeInTheDocument();
    expect(within(document.getElementById("f-skill-sugerencias")!).queryAllByRole("button")).toHaveLength(0);
    fireEvent.keyDown(buscar, { key: "Enter" });
    expect(screen.queryByText("Inventada", { selector: "strong" })).toBeNull();
  });
  it("no ofrece las ya elegidas", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    fireEvent.change(screen.getByLabelText(t("form.skill.search")), { target: { value: "rust" } });
    expect(screen.queryByRole("button", { name: `${t("form.skill.add")} Rust` })).toBeNull();
  });
});

describe("F7 extracción fallida", () => {
  it("explica en español y ofrece llenar a mano", async () => {
    backend();
    await subirYRevisar({ status: "failed", reason: "sin_texto", proposal: null });
    expect(await screen.findByText(t("review.failed.sin_texto"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("review.confirm") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t("review.failed.manual") }));
    expect(screen.getByRole("button", { name: t("review.confirm") })).toBeInTheDocument();
    expect(screen.getByLabelText(t("form.skill.search"))).toBeInTheDocument();
  });
  it.each(["ilegible", "tiempo_agotado"] as const)("motivo %s", async (reason) => {
    backend();
    await subirYRevisar({ status: "failed", reason, proposal: null });
    expect(await screen.findByText(t(`review.failed.${reason}`))).toBeInTheDocument();
  });
});

describe("F8 confirmar una sola vez", () => {
  it("doble clic no duplica y lleva al perfil", async () => {
    const { llamadas } = backend();
    await subirYRevisar();
    await revisar();
    const boton = screen.getByRole("button", { name: t("review.confirm") });
    fireEvent.click(boton);
    fireEvent.click(boton);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/profile"));
    expect(llamadas.filter((c) => c.url === CONFIRM_URL)).toHaveLength(1);
  });
  it("si falla, se puede reintentar y no navega", async () => {
    backend((c) => (c.url === CONFIRM_URL ? jsonRes(502, { error: "servicio_no_disponible" }) : null));
    await subirYRevisar();
    await revisar();
    fireEvent.click(screen.getByRole("button", { name: t("review.confirm") }));
    await alertaCon(t("cv.error.unavailable"));
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t("review.confirm") })).toBeEnabled();
  });
});

describe("F9 errores de la API en español", () => {
  it.each([
    [409, "limite_de_cvs", "cv.error.limit"],
    [413, "archivo_demasiado_grande", "cv.error.tooBig"],
    [415, "tipo_no_permitido", "cv.error.badType"],
    [422, "datos_invalidos", "cv.error.invalid"],
  ] as const)("al subir: %i %s", async (status, error, key) => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    FakeXHR.last.terminar(status, { error });
    const aviso = await alertaCon(t(key));
    expect(aviso.textContent).not.toMatch(/_|file|skill_id|storage|\b4\d\d\b/);
  });
  it("al confirmar: 422 se muestra en español y la persona sigue editando", async () => {
    backend((c) => (c.url === CONFIRM_URL ? jsonRes(422, { error: "datos_invalidos" }) : null));
    await subirYRevisar();
    await revisar();
    fireEvent.click(screen.getByRole("button", { name: t("review.confirm") }));
    await alertaCon(t("cv.error.invalid"));
    expect(screen.getByLabelText(t("form.exp.company"))).toBeInTheDocument();
  });
  it("sesión vencida (401) al subir lleva a /sign-in", () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    FakeXHR.last.terminar(401, { error: "sesion_expirada" });
    expect(goTo).toHaveBeenCalledWith("/sign-in");
  });
});

describe("F14 accesibilidad", () => {
  it("el error de validación se anuncia y el foco va al primer campo con error", async () => {
    const { llamadas } = backend();
    await subirYRevisar();
    await revisar();
    const empresa = screen.getByLabelText(t("form.exp.company"));
    fireEvent.change(empresa, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t("review.confirm") }));
    expect(empresa).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(empresa);
    expect(screen.getByRole("alert")).toHaveTextContent(t("form.error.summary"));
    expect(empresa).toHaveAccessibleDescription(t("form.error.required"));
    expect(llamadas.some((c) => c.url === CONFIRM_URL)).toBe(false);
  });
  it("fin anterior al inicio es un error de validación", async () => {
    backend();
    await subirYRevisar();
    await revisar();
    fireEvent.change(screen.getByLabelText(t("form.exp.end")), { target: { value: "2020-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: t("review.confirm") }));
    expect(screen.getByLabelText(t("form.exp.end"))).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(screen.getByLabelText(t("form.exp.end")));
  });
  it("los mensajes de error viven en regiones aria-live", () => {
    backend();
    render(<CvFlow />);
    elegir(archivo("foto.png", "image/png"));
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });
  it("el selector y el botón se alcanzan con teclado (sin tabindex negativo)", () => {
    backend();
    render(<CvFlow />);
    for (const el of [screen.getByLabelText(t("cv.upload.fileLabel")), screen.getByRole("button", { name: t("cv.upload.submit") })]) {
      expect(el.getAttribute("tabindex")).not.toBe("-1");
    }
  });
});

describe("selector de archivo en español", () => {
  it("sin archivo dice «Ningún archivo elegido» y ofrece el botón en español", () => {
    backend();
    const { container } = render(<CvFlow />);
    expect(screen.getByText(t("cv.upload.noFile"))).toBeInTheDocument();
    expect(screen.getByText(t("cv.upload.choose"))).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/choose file|no file chosen/i);
  });
  it("muestra el nombre del archivo elegido en lugar del estado vacío", () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();
    expect(screen.queryByText(t("cv.upload.noFile"))).not.toBeInTheDocument();
  });
  it("el input real sigue accesible por etiqueta, tipo file y sin display:none ni hidden", () => {
    backend();
    render(<CvFlow />);
    const input = screen.getByLabelText(t("cv.upload.fileLabel"));
    expect(input).toHaveAttribute("type", "file");
    expect(input).not.toHaveAttribute("hidden");
    expect(input).not.toHaveAttribute("aria-hidden");
    expect(input.getAttribute("style") ?? "").not.toMatch(/display\s*:\s*none/);
  });
});

describe("JB-78 arrastrar y soltar", () => {
  const zona = () => screen.getByTestId("cv-zona");
  it("soltar un PDF lo deja elegido y habilita la subida", () => {
    backend();
    render(<CvFlow />);
    fireEvent.drop(zona(), { dataTransfer: { files: [PDF()] } });
    expect(screen.getByText("cv.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("cv.upload.submit") })).toBeEnabled();
  });
  it("soltar un tipo no permitido o uno pesado da el mismo aviso que el selector", () => {
    backend();
    render(<CvFlow />);
    fireEvent.drop(zona(), { dataTransfer: { files: [archivo("foto.png", "image/png")] } });
    expect(screen.getByRole("alert")).toHaveTextContent(t("cv.error.badType"));
    fireEvent.drop(zona(), { dataTransfer: { files: [archivo("cv.pdf", "application/pdf", 5 * 1024 * 1024 + 1)] } });
    expect(screen.getByRole("alert")).toHaveTextContent(t("cv.error.tooBig"));
    expect(FakeXHR.instancias).toHaveLength(0);
  });
  it("al arrastrar encima se resalta y al salir se quita", () => {
    backend();
    render(<CvFlow />);
    fireEvent.dragOver(zona(), { dataTransfer: { files: [] } });
    expect(zona()).toHaveAttribute("data-arrastrando", "true");
    fireEvent.dragLeave(zona());
    expect(zona()).not.toHaveAttribute("data-arrastrando");
  });
  it("mientras sube no acepta otro archivo soltado", () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    fireEvent.drop(zona(), { dataTransfer: { files: [archivo("otro.pdf", "application/pdf")] } });
    expect(screen.queryByText("otro.pdf")).not.toBeInTheDocument();
  });
});

describe("JB-78 estado analizando", () => {
  it("al terminar de subir anuncia que está analizando el CV hasta que llega la respuesta", async () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    expect(screen.queryByText(t("cv.upload.analyzing"))).not.toBeInTheDocument();
    FakeXHR.last.progreso(100, 100);
    expect(screen.getByRole("status")).toHaveTextContent(t("cv.upload.analyzing"));
    FakeXHR.last.terminar(201, CREADO());
    await revisar();
    expect(screen.queryByText(t("cv.upload.analyzing"))).not.toBeInTheDocument();
  });
});

describe("JB-78 errores de red y de servicio", () => {
  it.each([
    [0, null, "cv.error.network"],
    [502, "servicio_no_disponible", "cv.error.unavailable"],
    [503, null, "cv.error.unavailable"],
    [429, "demasiadas_solicitudes", "cv.error.tooMany"],
  ] as const)("al subir: estado %i", async (status, error, key) => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    if (status === 0) FakeXHR.last.fallarRed();
    else FakeXHR.last.terminar(status, error ? { error } : {});
    await alertaCon(t(key));
    expect(screen.getByRole("button", { name: t("cv.upload.submit") })).toBeEnabled();
  });
  it("un 415 por contenido (archivo dañado o renombrado) explica qué hacer", async () => {
    backend();
    render(<CvFlow />);
    elegir(PDF());
    fireEvent.click(screen.getByRole("button", { name: t("cv.upload.submit") }));
    FakeXHR.last.terminar(415, { error: "tipo_no_permitido" });
    await alertaCon(/dañado/i);
  });
});
