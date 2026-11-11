/** HU-31 en la web: «Practicar esta entrevista» desde una oferta crea la sesión con `job_offer_id` y va a la sala. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { items, LEVELS, LVL_ID, RECRUITERS, REC_ID, SESION, SID } from "./helpers/interview";
import { OID } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import PracticeOffer from "@/app/_components/PracticeOffer";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

type Manejador = (c: Llamada) => Response | Promise<Response> | undefined;

function backend(extra: Manejador = () => undefined, o: { recruiters?: unknown; levels?: unknown } = {}) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.url === "/api/recruiters") return jsonRes(200, o.recruiters ?? items(RECRUITERS));
    if (c.url === "/api/levels") return jsonRes(200, o.levels ?? items(LEVELS));
    if (c.url === "/api/interviews" && c.method === "POST") return jsonRes(201, SESION());
    return jsonRes(404);
  });
}
const boton = () => screen.getByRole("button", { name: t("offer.practice.button") });
const creaciones = (ll: Llamada[]) => ll.filter((c) => c.url === "/api/interviews" && c.method === "POST");

describe("Practicar esta entrevista", () => {
  it("es un botón con su explicación, de tono secundario", () => {
    backend();
    render(<PracticeOffer offerId={OID} />);
    expect(boton()).toHaveClass("boton--borde");
    expect(screen.getByText(t("offer.practice.hint"))).toBeInTheDocument();
  });
  it("crea la sesión con el job_offer_id, la primera recruiter y el nivel más bajo disponible, y va a la sala", async () => {
    const { llamadas } = backend();
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(`/interviews/${SID}`), ESPERA);
    expect(creaciones(llamadas)).toHaveLength(1);
    expect(creaciones(llamadas)[0].body).toEqual({ recruiter_id: REC_ID, level_id: LVL_ID, job_offer_id: OID });
  });
  it("prefiere a Ana aunque no venga primera, y salta los niveles bloqueados o no disponibles", async () => {
    const [ana, martin] = RECRUITERS;
    const bloqueado = { ...LEVELS[0], id: "44444444-4444-4444-8444-4444444444aa", position: 0, unlocked: false };
    const { llamadas } = backend(() => undefined, { recruiters: items([martin, ana]), levels: items([bloqueado, ...LEVELS]) });
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    await waitFor(() => expect(goTo).toHaveBeenCalled(), ESPERA);
    expect(creaciones(llamadas)[0].body).toMatchObject({ recruiter_id: ana.id, level_id: LVL_ID });
  });
  it("mientras crea, el botón queda deshabilitado y un doble clic crea una sola sesión", async () => {
    let soltar: () => void = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    const { llamadas } = backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? espera.then(() => jsonRes(201, SESION())) : undefined));
    render(<PracticeOffer offerId={OID} />);
    dobleClic(boton());
    await waitFor(() => expect(creaciones(llamadas)).toHaveLength(1), ESPERA);
    expect(screen.getByRole("button", { name: t("offer.practice.starting") })).toBeDisabled();
    soltar();
    await waitFor(() => expect(goTo).toHaveBeenCalledTimes(1), ESPERA);
    expect(creaciones(llamadas)).toHaveLength(1);
  });
  it("sesión en curso: lo dice y ofrece retomarla", async () => {
    backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? jsonRes(409, { error: "sesion_en_curso", session_id: SID }) : undefined));
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.error.activeSession"));
    expect(screen.getByRole("link", { name: t("interview.start.resumeActive") })).toHaveAttribute("href", `/interviews/${SID}`);
    expect(goTo).not.toHaveBeenCalled();
    expect(boton()).not.toBeDisabled();
  });
  it("límite del plan: dice cuándo se renueva", async () => {
    backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? jsonRes(403, { error: "limite_del_plan", renews_at: "2026-12-01T00:00:00Z" }) : undefined));
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(/diciembre|1 de dic|2026/i);
  });
  it("404: la oferta ya no está disponible para practicar", async () => {
    backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? jsonRes(404, { error: "no_encontrado" }) : undefined));
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offer.practice.notAvailable"));
  });
  it("si no hay nivel disponible y desbloqueado, lo explica sin crear nada", async () => {
    const todos = LEVELS.map((l) => ({ ...l, unlocked: false }));
    const { llamadas } = backend(() => undefined, { levels: items(todos) });
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offer.practice.noLevel"));
    expect(creaciones(llamadas)).toHaveLength(0);
  });
  it("si no cargan los recruiters o los niveles, error con reintento posible", async () => {
    let falla = true;
    const { llamadas } = backend((c) => (falla && c.url === "/api/levels" ? jsonRes(503, { error: "motor_no_disponible" }) : undefined));
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("offer.practice.loadError"));
    expect(creaciones(llamadas)).toHaveLength(0);
    falla = false;
    fireEvent.click(boton());
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(`/interviews/${SID}`), ESPERA);
  });
  it("un error de red no deja el botón colgado", async () => {
    backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? jsonRes(500) : undefined));
    render(<PracticeOffer offerId={OID} />);
    fireEvent.click(boton());
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.error.generic"));
    expect(boton()).not.toBeDisabled();
  });
  it("el texto de ayuda menciona que es práctica: no aplica a la oferta", () => {
    backend();
    render(<PracticeOffer offerId={OID} />);
    expect(t("offer.practice.hint")).toMatch(/no/i);
    expect(tf("interview.room.practicing", { title: "X" })).toContain("X");
  });
});
