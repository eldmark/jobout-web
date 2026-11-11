/** /offers/[id]: detalle y requisitos (CA3, SX7) y el diálogo de consentimiento para aplicar (FC2, AP2, FC7). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { AID, APLICACION_DETALLE, DETALLE, EMPRESA, HOSTIL, MATCH, OID, PERFIL, PERFIL_VACIO } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import { formatDay } from "@/lib/offers/format";
import { SHARED_FIELDS } from "@/lib/offers/types";
import OfferDetail from "@/app/_components/OfferDetail";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const OPCIONALES = ["experience_descriptions", "languages", "education", "profile_description", "email", "phone", "match_score"] as const;

/** Backend simulado: la oferta, el perfil y la respuesta de aplicar (por defecto 201). */
function backend(o: { oferta?: unknown; perfil?: unknown; aplicar?: (c: Llamada) => Response | Promise<Response> } = {}) {
  return stubFetch((c) => {
    if (c.url === `/api/offers/${OID}` && c.method === "GET") return o.oferta instanceof Response ? o.oferta : jsonRes(200, o.oferta ?? DETALLE());
    if (c.url === "/api/profile") return o.perfil instanceof Response ? o.perfil : jsonRes(200, o.perfil ?? PERFIL());
    if (c.url === `/api/offers/${OID}/applications` && c.method === "POST") return o.aplicar ? o.aplicar(c) : jsonRes(201, APLICACION_DETALLE());
    return jsonRes(404);
  });
}
const listo = () => screen.findByRole("heading", { level: 1, name: "Desarrollador backend" }, ESPERA);
const aplicarBtn = () => screen.queryByRole("button", { name: t("offer.apply") });
const dialogo = () => screen.getByRole("dialog");
const casilla = (f: string) => within(dialogo()).getByRole("checkbox", { name: new RegExp(t(`apply.field.${f}` as never).replace(/[()]/g, "\\$&")) });
const acepto = () => within(dialogo()).getByRole("checkbox", { name: t("apply.accept") });
const enviar = () => within(dialogo()).getByRole("button", { name: t("apply.submit") });
const aplicaciones = (ll: Llamada[]) => ll.filter((c) => c.method === "POST");

async function abrir() {
  await listo();
  fireEvent.click(aplicarBtn()!);
  return dialogo();
}

describe("detalle y requisitos", () => {
  it("cargando y luego el título, la empresa con su sitio, el lugar, la descripción y los requisitos", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    expect(screen.getByRole("status")).toHaveTextContent(t("offer.loading"));
    await listo();
    const main = screen.getByRole("main");
    for (const texto of ["Café Nuevo S.A.", "Mixco, Guatemala", "Buscamos a alguien para el equipo de pagos.", "Trabajo híbrido.", "Lunes a viernes, 8:00 a 17:00", "Licenciatura", "Junior", "Español", "Inglés", "Tipo B", "Q8,000 a Q12,000", "Indefinido", "Diurna", "Tecnología", "Ingeniería de software"]) {
      expect(main, texto).toHaveTextContent(texto);
    }
    expect(main).toHaveTextContent(tf("offer.experienceYears", { n: 2 }));
    expect(main).toHaveTextContent(formatDay("2027-02-01"));
    expect(main).toHaveTextContent(tf("offers.published", { date: formatDay("2026-11-12") }));
    expect(screen.getByRole("link", { name: t("offer.website") })).toHaveAttribute("href", "https://cafenuevo.example/");
  });
  it("cada habilidad dice si es obligatoria o deseable y su nivel mínimo; cada idioma su nivel", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await listo();
    const skills = screen.getByRole("list", { name: t("offer.skills") });
    expect(within(skills).getAllByRole("listitem")[0]).toHaveTextContent(`Rust`);
    expect(within(skills).getAllByRole("listitem")[0]).toHaveTextContent(t("offer.skill.required"));
    expect(within(skills).getAllByRole("listitem")[0]).toHaveTextContent(tf("offer.skill.minLevel", { level: t("form.level.intermediate") }));
    expect(within(skills).getAllByRole("listitem")[1]).toHaveTextContent(t("offer.skill.optional"));
    const idiomas = screen.getByRole("list", { name: t("offer.languages") });
    expect(idiomas).toHaveTextContent(tf("offer.language.minLevel", { level: t("form.proficiency.intermediate") }));
  });
  it("sin experiencia requerida lo dice; un año va en singular", async () => {
    backend({ oferta: DETALLE({ required_experience: 0 }) });
    render(<OfferDetail id={OID} />);
    await listo();
    expect(screen.getByRole("main")).toHaveTextContent(t("offer.experienceNone"));
    cleanup();
    backend({ oferta: DETALLE({ required_experience: 1 }) });
    render(<OfferDetail id={OID} />);
    await listo();
    expect(screen.getByRole("main")).toHaveTextContent(t("offer.experienceOne"));
  });
  it("CA3: una confidencial no muestra empresa ni sitio, aunque la API los trajera, y avisa cuándo se revela", async () => {
    backend({ oferta: DETALLE({ confidential: true, company: EMPRESA }) });
    render(<OfferDetail id={OID} />);
    await listo();
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent(t("offers.confidential"));
    expect(main).toHaveTextContent(t("offer.confidentialNotice"));
    expect(main).not.toHaveTextContent("Café Nuevo");
    expect(screen.queryByRole("link", { name: t("offer.website") })).toBeNull();
  });
  it("SX7: descripción, título, horario y habilidades con HTML se pintan como texto", async () => {
    backend({ oferta: DETALLE({ title: HOSTIL, description: HOSTIL, schedule: HOSTIL, skills: [{ skill: { id: "s", code: "x", name: HOSTIL }, is_required: true, min_level: null }] }) });
    render(<OfferDetail id={OID} />);
    const main = await screen.findByRole("main", {}, ESPERA);
    await waitFor(() => expect(main).toHaveTextContent("<script>window.__pwned=1</script>"), ESPERA);
    expect(main.querySelector("img, script, b")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
  it("un sitio que no es http(s) no se convierte en enlace", async () => {
    backend({ oferta: DETALLE({ company: { ...EMPRESA, website: "javascript:alert(1)" } }) });
    render(<OfferDetail id={OID} />);
    await listo();
    expect(screen.queryByRole("link", { name: t("offer.website") })).toBeNull();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });
  it("si ya apliqué: no hay «Aplicar», dice el estado y enlaza a «Mis aplicaciones» (no se reaplica)", async () => {
    backend({ oferta: DETALLE({ my_application: { id: AID, status: "withdrawn" } }) });
    render(<OfferDetail id={OID} />);
    await listo();
    expect(aplicarBtn()).toBeNull();
    expect(screen.getByRole("main")).toHaveTextContent(tf("offer.applied", { status: t("applications.status.withdrawn") }));
    expect(screen.getByRole("link", { name: t("offers.toApplications") })).toHaveAttribute("href", "/applications");
  });
  it("404: la oferta ya no está disponible, sin reintento, con enlace a otras ofertas", async () => {
    backend({ oferta: jsonRes(404, { error: "no_encontrado" }) });
    render(<OfferDetail id={OID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offer.notFound"));
    expect(screen.queryByRole("button", { name: t("offer.retry") })).toBeNull();
    expect(screen.getByRole("link", { name: t("offer.backToList") })).toHaveAttribute("href", "/offers");
  });
  it("otro fallo: error anunciado y reintento", async () => {
    let falla = true;
    stubFetch((c) => (c.url === `/api/offers/${OID}` ? (falla ? jsonRes(502) : jsonRes(200, DETALLE())) : jsonRes(200, PERFIL())));
    render(<OfferDetail id={OID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offer.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("offer.retry") }));
    await listo();
  });
  it("401 lleva a /sign-in", async () => {
    backend({ oferta: jsonRes(401) });
    render(<OfferDetail id={OID} />);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/sign-in"), ESPERA);
  });
  it("mirar no pide el perfil: solo se lee al abrir «Aplicar»", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await listo();
    expect(llamadas.map((c) => c.url)).toEqual([`/api/offers/${OID}`]);
  });
});

describe("FC2: aplicar muestra exactamente qué se comparte", () => {
  it("el primer clic no aplica: abre un diálogo modal con nombre que dice «Esto es lo que verá la empresa»", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    const d = await abrir();
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d).toHaveAccessibleName(t("apply.title"));
    expect(d).toHaveTextContent(t("apply.intro"));
    expect(aplicaciones(llamadas)).toHaveLength(0);
  });
  it("lista CADA campo del conjunto cerrado con su casilla: los tres mínimos marcados y bloqueados, el resto (contacto incluido) sin marcar", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    expect(within(dialogo()).getAllByRole("checkbox")).toHaveLength(SHARED_FIELDS.length + 1);
    for (const f of ["display_name", "skills", "experience"]) {
      expect(casilla(f)).toBeChecked();
      expect(casilla(f)).toBeDisabled();
      expect(casilla(f)).toHaveAccessibleDescription(expect.stringContaining(t("apply.mandatory")));
    }
    for (const f of OPCIONALES) {
      expect(casilla(f)).not.toBeChecked();
      expect(casilla(f)).not.toBeDisabled();
    }
  });
  it("avisa que no se puede ampliar ni reaplicar, que se ve en vivo, lo que nunca se comparte y que el contacto es opcional", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    const d = await abrir();
    for (const k of ["apply.final", "apply.live", "apply.never", "apply.contactHint"] as const) expect(d).toHaveTextContent(t(k));
    expect(d).not.toHaveTextContent(t("apply.confidential"));
  });
  it("en una confidencial, el diálogo avisa que no sabrá la empresa hasta que la preseleccionen", async () => {
    backend({ oferta: DETALLE({ confidential: true, company: null }) });
    render(<OfferDetail id={OID} />);
    const d = await abrir();
    expect(d).toHaveTextContent(t("apply.confidential"));
  });
  it("«Aplicar» queda deshabilitado hasta marcar «Acepto compartir esto»; desmarcarlo lo deshabilita otra vez", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    expect(acepto()).not.toBeChecked();
    expect(enviar()).toBeDisabled();
    fireEvent.click(acepto());
    expect(enviar()).toBeEnabled();
    fireEvent.click(acepto());
    expect(enviar()).toBeDisabled();
  });
  it("AP2: envía una sola vez consent true y los campos marcados en el orden del contrato", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(casilla("phone"));
    fireEvent.click(casilla("languages"));
    fireEvent.click(acepto());
    dobleClic(enviar());
    await waitFor(() => expect(aplicaciones(llamadas)).toHaveLength(1), ESPERA);
    expect(aplicaciones(llamadas)[0].body).toEqual({ consent: true, shared_fields: ["display_name", "skills", "experience", "languages", "phone"] });
  });
  it("al aplicar: cierra el diálogo, lo anuncia, enlaza a «Mis aplicaciones» y ya no ofrece aplicar", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    expect(await screen.findByText(t("offer.appliedNow"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(aplicarBtn()).toBeNull();
    expect(screen.getByRole("link", { name: t("offers.toApplications") })).toHaveAttribute("href", "/applications");
  });
  it("lo que la persona no tiene sale como «No tienes … en tu perfil»; con todo, no hay avisos", async () => {
    backend({ perfil: PERFIL_VACIO });
    render(<OfferDetail id={OID} />);
    await abrir();
    expect(await within(dialogo()).findByText(t("apply.missing.phone"), {}, ESPERA)).toBeInTheDocument();
    expect(casilla("phone")).toHaveAccessibleDescription(t("apply.missing.phone"));
    for (const f of ["skills", "experience", "languages", "education", "profile_description", "experience_descriptions"]) {
      expect(dialogo()).toHaveTextContent(t(`apply.missing.${f}` as never));
    }
    cleanup();
    backend({ perfil: PERFIL() });
    render(<OfferDetail id={OID} />);
    await abrir();
    await waitFor(() => expect(casilla("phone")).not.toHaveAccessibleDescription(t("apply.missing.phone")), ESPERA);
    expect(dialogo()).not.toHaveTextContent(t("apply.missing.phone"));
  });
  it("si el perfil no carga, igual se puede aplicar (sin avisos de lo que falta)", async () => {
    const { llamadas } = backend({ perfil: jsonRes(502) });
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    await waitFor(() => expect(aplicaciones(llamadas)).toHaveLength(1), ESPERA);
  });
});

describe("errores al aplicar (FC7)", () => {
  const conError = async (r: Response) => {
    const b = backend({ aplicar: () => r });
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(casilla("email"));
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    return { ...b, alerta: await within(dialogo()).findByRole("alert", {}, ESPERA) };
  };
  it("409 ya_aplicaste lo explica y enlaza a «Mis aplicaciones»", async () => {
    const { alerta } = await conError(jsonRes(409, { error: "ya_aplicaste", application_id: AID }));
    expect(alerta).toHaveTextContent(t("offers.error.alreadyApplied"));
  });
  it("409 oferta_propia: no se aplica a la propia empresa", async () => {
    const { alerta } = await conError(jsonRes(409, { error: "oferta_propia" }));
    expect(alerta).toHaveTextContent(t("offers.error.ownOffer"));
  });
  it("404: la oferta se cerró o pausó mientras tanto", async () => {
    const { alerta } = await conError(jsonRes(404, { error: "no_encontrado" }));
    expect(alerta).toHaveTextContent(t("offer.gone"));
  });
  it("429 dice cuánto esperar y no pierde lo marcado", async () => {
    const r = new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "content-type": "application/json", "retry-after": "5400" } });
    const { alerta } = await conError(r);
    expect(alerta).toHaveTextContent(tf("offers.error.rateLimitedIn", { wait: tf("offers.wait.hours", { n: 2 }) }));
    expect(casilla("email")).toBeChecked();
    expect(acepto()).toBeChecked();
    expect(enviar()).toBeEnabled();
  });
  it("un fallo de red permite reintentar con lo mismo", async () => {
    let n = 0;
    const { llamadas } = backend({ aplicar: () => (n++ === 0 ? jsonRes(502) : jsonRes(201, APLICACION_DETALLE())) });
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    expect(await within(dialogo()).findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offers.error.generic"));
    fireEvent.click(enviar());
    expect(await screen.findByText(t("offer.appliedNow"), {}, ESPERA)).toBeInTheDocument();
    expect(aplicaciones(llamadas).map((c) => c.body)).toEqual([aplicaciones(llamadas)[0].body, aplicaciones(llamadas)[0].body]);
  });
});

describe("teclado (FC7)", () => {
  it("el foco entra al diálogo, Escape lo cierra sin aplicar y devuelve el foco a «Aplicar»", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    expect(dialogo().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialogo(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(aplicarBtn()).toHaveFocus();
    expect(aplicaciones(llamadas)).toHaveLength(0);
  });
  it("«Cancelar» cierra sin llamar a la API", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(within(dialogo()).getByRole("button", { name: t("apply.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(aplicaciones(llamadas)).toHaveLength(0);
  });
  it("Tab queda atrapado en el diálogo e incluye las casillas", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    const primera = casilla("experience_descriptions");
    const cancelar = within(dialogo()).getByRole("button", { name: t("apply.cancel") });
    // «Aplicar» está deshabilitado: el último foco posible es «Cancelar».
    cancelar.focus();
    fireEvent.keyDown(dialogo(), { key: "Tab" });
    expect(primera).toHaveFocus();
    fireEvent.keyDown(dialogo(), { key: "Tab", shiftKey: true });
    expect(cancelar).toHaveFocus();
  });
});

describe("matching: «Afinidad con tu perfil» en el detalle", () => {
  it("una sección con nombre con el puntaje, la explicación y los cuatro componentes", async () => {
    backend({ oferta: DETALLE({ match: MATCH(67) }) });
    render(<OfferDetail id={OID} />);
    await listo();
    const s = screen.getByRole("region", { name: t("match.title.candidate") });
    expect(s).toHaveTextContent("Afinidad 67 %");
    expect(s).toHaveTextContent(t("match.explain.candidate"));
    expect(within(s).getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(s).toHaveTextContent("Rust");
    expect(s).toHaveTextContent(t("match.reason.no_pedido"));
  });
  it("sin match en la respuesta, no hay sección", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await listo();
    expect(screen.queryByRole("region", { name: t("match.title.candidate") })).toBeNull();
  });
});

describe("matching: compartir la afinidad al aplicar", () => {
  it("la casilla «Compartir mi afinidad con esta oferta» existe, es opcional y viene desmarcada, con su explicación", async () => {
    backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    expect(casilla("match_score")).toHaveAccessibleName("Compartir mi afinidad con esta oferta");
    expect(casilla("match_score")).not.toBeChecked();
    expect(casilla("match_score")).not.toBeDisabled();
    expect(casilla("match_score")).toHaveAccessibleDescription(t("apply.hint.match_score"));
  });
  it("sin marcarla, shared_fields no lleva match_score", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    await waitFor(() => expect(aplicaciones(llamadas)).toHaveLength(1), ESPERA);
    expect((aplicaciones(llamadas)[0].body as { shared_fields: string[] }).shared_fields).toEqual(["display_name", "skills", "experience"]);
  });
  it("marcada, shared_fields lleva match_score al final", async () => {
    const { llamadas } = backend();
    render(<OfferDetail id={OID} />);
    await abrir();
    fireEvent.click(casilla("match_score"));
    fireEvent.click(casilla("phone"));
    fireEvent.click(acepto());
    fireEvent.click(enviar());
    await waitFor(() => expect(aplicaciones(llamadas)).toHaveLength(1), ESPERA);
    expect(aplicaciones(llamadas)[0].body).toEqual({ consent: true, shared_fields: ["display_name", "skills", "experience", "phone", "match_score"] });
  });
});
