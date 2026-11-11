/** F2, F3, F13, F14: elegir recruiter y nivel, y empezar una sola vez. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { SID, SESION, RECRUITERS, LEVELS, items } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import InterviewStart from "@/app/_components/InterviewStart";
import { alertaCon } from "./helpers/alerta";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function backend(extra: (c: Llamada) => Response | undefined = () => undefined) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.url === "/api/recruiters") return jsonRes(200, items(RECRUITERS));
    if (c.url === "/api/levels") return jsonRes(200, items(LEVELS));
    return jsonRes(404);
  });
}
const posts = (llamadas: Llamada[]) => llamadas.filter((c) => c.method === "POST");
async function elegir(recruiter = "Ana", nivel = "Junior") {
  fireEvent.click(await screen.findByRole("radio", { name: new RegExp(recruiter) }, ESPERA));
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(nivel) }));
}
const empezar = () => screen.getByRole("button", { name: t("interview.start.submit") });

describe("F2 elegir recruiter y nivel", () => {
  it("muestra un estado de carga y luego los recruiters con su rol y personalidad", async () => {
    backend();
    render(<InterviewStart />);
    expect(screen.getByRole("status")).toHaveTextContent(t("interview.start.loading"));
    const grupo = await screen.findByRole("group", { name: t("interview.recruiter.legend") }, ESPERA);
    for (const r of RECRUITERS) {
      const radio = within(grupo).getByRole("radio", { name: new RegExp(r.display_name) });
      expect(radio).toBeEnabled();
      const tarjeta = radio.closest(".opcion")!;
      expect(tarjeta).toHaveTextContent(r.role_title);
      expect(tarjeta).toHaveTextContent(r.personality);
    }
  });
  it("un nivel bloqueado aparece deshabilitado con el motivo, y uno no disponible también", async () => {
    backend();
    render(<InterviewStart />);
    const grupo = await screen.findByRole("group", { name: t("interview.level.legend") }, ESPERA);
    expect(within(grupo).getAllByRole("radio")).toHaveLength(5);
    expect(within(grupo).getByRole("radio", { name: /Junior/ })).toBeEnabled();

    const startup = within(grupo).getByRole("radio", { name: /Startup/ });
    expect(startup).toBeDisabled();
    const motivo = tf("interview.level.lockedScore", { min: 60, previous: "Junior" });
    expect(startup).toHaveAccessibleDescription(motivo);
    expect(grupo).toHaveTextContent(motivo);

    const amazon = within(grupo).getByRole("radio", { name: /Amazon/ });
    expect(amazon).toBeDisabled();
    expect(amazon).toHaveAccessibleDescription(t("interview.level.unavailable"));
  });
  it("un nivel deshabilitado no cuenta como elegido aunque se haga clic: no se puede empezar con él", async () => {
    const { llamadas } = backend();
    render(<InterviewStart />);
    fireEvent.click(await screen.findByRole("radio", { name: /Ana/ }, ESPERA));
    fireEvent.click(screen.getByRole("radio", { name: /Startup/ }));
    fireEvent.click(empezar());
    expect(posts(llamadas)).toHaveLength(0);
    expect(screen.getByText(t("interview.start.validation.level"))).toBeInTheDocument();
  });
  it("si no cargan los datos: error anunciado y se puede reintentar", async () => {
    let falla = true;
    backend((c) => (falla && c.url === "/api/levels" ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<InterviewStart />);
    await alertaCon(t("interview.start.loadError"), ESPERA);
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.start.retry") }));
    expect(await screen.findByRole("group", { name: t("interview.recruiter.legend") }, ESPERA)).toBeInTheDocument();
    expect(screen.queryByText(t("interview.start.loadError"))).toBeNull();
  });
  it("enlaza a mi progreso", async () => {
    backend();
    render(<InterviewStart />);
    expect(await screen.findByRole("link", { name: t("interview.start.progressLink") }, ESPERA)).toHaveAttribute("href", "/interviews/progress");
  });
});

describe("enlaces", () => {
  it("lleva al progreso y a la lista de entrevistas", async () => {
    backend();
    render(<InterviewStart />);
    await screen.findByRole("group", { name: t("interview.recruiter.legend") }, ESPERA);
    expect(screen.getByRole("link", { name: t("interview.start.progressLink") })).toHaveAttribute("href", "/interviews/progress");
    expect(screen.getByRole("link", { name: t("interview.start.sessionsLink") })).toHaveAttribute("href", "/interviews/sessions");
  });
});

describe("F3 empezar crea la sesión una sola vez", () => {
  it("doble clic -> un solo POST y navega a la conversación", async () => {
    const { llamadas } = backend((c) => (c.method === "POST" && c.url === "/api/interviews" ? jsonRes(201, SESION()) : undefined));
    render(<InterviewStart />);
    await elegir();
    const b = empezar();
    dobleClic(b);
    fireEvent.submit(b.closest("form")!);
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledWith(`/interviews/${SID}`), ESPERA);
    expect(posts(llamadas)).toHaveLength(1);
    expect(posts(llamadas)[0].body).toEqual({ recruiter_id: RECRUITERS[0].id, level_id: LEVELS[0].id });
    expect(goTo).toHaveBeenCalledTimes(1);
  });
  it("mientras crea, el botón se deshabilita y dice que está trabajando", async () => {
    let soltar: (r: Response) => void = () => {};
    const { llamadas } = stubFetch((c) => {
      if (c.url === "/api/recruiters") return jsonRes(200, items(RECRUITERS));
      if (c.url === "/api/levels") return jsonRes(200, items(LEVELS));
      return new Promise<Response>((res) => (soltar = res)) as unknown as Response;
    });
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    const b = await screen.findByRole("button", { name: t("interview.start.submitting") }, ESPERA);
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    soltar(jsonRes(201, SESION()));
    await vi.waitFor(() => expect(goTo).toHaveBeenCalled(), ESPERA);
    expect(posts(llamadas)).toHaveLength(1);
  });
});

describe("F14 validación accesible y foco al primer error", () => {
  it("sin elegir nada: no llama a la API, explica y enfoca el primer error", async () => {
    const { llamadas } = backend();
    render(<InterviewStart />);
    await screen.findByRole("group", { name: t("interview.recruiter.legend") }, ESPERA);
    fireEvent.click(empezar());
    expect(posts(llamadas)).toHaveLength(0);
    const g1 = screen.getByRole("group", { name: t("interview.recruiter.legend") });
    expect(g1).toHaveAccessibleDescription(t("interview.start.validation.recruiter"));
    expect(screen.getByText(t("interview.start.validation.level"))).toBeInTheDocument();
    expect(within(g1).getAllByRole("radio")[0]).toHaveFocus();
  });
  it("con recruiter pero sin nivel: el foco va al primer nivel habilitado", async () => {
    backend();
    render(<InterviewStart />);
    fireEvent.click(await screen.findByRole("radio", { name: /Ana/ }, ESPERA));
    fireEvent.click(empezar());
    expect(screen.queryByText(t("interview.start.validation.recruiter"))).toBeNull();
    expect(screen.getByRole("radio", { name: /Junior/ })).toHaveFocus();
  });
  it("el error de validación se limpia al elegir", async () => {
    backend();
    render(<InterviewStart />);
    await screen.findByRole("group", { name: t("interview.recruiter.legend") }, ESPERA);
    fireEvent.click(empezar());
    fireEvent.click(screen.getByRole("radio", { name: /Ana/ }));
    expect(screen.queryByText(t("interview.start.validation.recruiter"))).toBeNull();
  });
  it("todo es operable con teclado: controles nativos, sin tabindex negativo, Enter envía el formulario", async () => {
    const { llamadas } = backend((c) => (c.method === "POST" ? jsonRes(201, SESION()) : undefined));
    const { container } = render(<InterviewStart />);
    await elegir();
    expect(container.querySelectorAll('[tabindex="-1"]')).toHaveLength(0);
    expect(empezar().tagName).toBe("BUTTON");
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => expect(posts(llamadas)).toHaveLength(1), ESPERA);
    // la navegación llega después del POST: sin esperarla se filtra al test siguiente
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledTimes(1), ESPERA);
  });
});

describe("F13 errores al empezar, en español y anunciados", () => {
  const casos: [number, unknown, string][] = [
    [403, { error: "nivel_bloqueado" }, "interview.error.levelLocked"],
    [403, { error: "limite_del_plan" }, "interview.error.planLimit"],
    [409, { error: "nivel_no_disponible" }, "interview.error.levelUnavailable"],
    [422, { error: "datos_invalidos" }, "interview.error.invalid"],
    [429, { error: "demasiados_intentos" }, "interview.error.rateLimited"],
    [503, { error: "motor_no_disponible" }, "interview.error.engineDown"],
  ];
  for (const [estado, cuerpo, clave] of casos) {
    it(`${estado} -> ${clave}, sin navegar y se puede volver a intentar`, async () => {
      const { llamadas } = backend((c) => (c.method === "POST" ? jsonRes(estado, cuerpo) : undefined));
      render(<InterviewStart />);
      await elegir();
      fireEvent.click(empezar());
      await alertaCon(t(clave as Parameters<typeof t>[0]), ESPERA);
      expect(goTo).not.toHaveBeenCalled();
      expect(empezar()).toBeEnabled();
      fireEvent.click(empezar());
      await vi.waitFor(() => expect(posts(llamadas)).toHaveLength(2), ESPERA);
    });
  }
  it("403 limite_del_plan muestra la fecha de renovación en es-GT (el día UTC, no el local)", async () => {
    process.env.TZ = "America/Guatemala";
    backend((c) => (c.method === "POST" ? jsonRes(403, { error: "limite_del_plan", renews_at: "2026-12-01T00:00:00Z" }) : undefined));
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    const alerta = await alertaCon(tf("interview.error.planLimitRenews", { date: "1 de diciembre de 2026" }), ESPERA);
    expect(alerta).toHaveTextContent("1 de diciembre de 2026");
    expect(goTo).not.toHaveBeenCalled();
    expect(empezar()).toBeEnabled();
  });
  it("429 con Retry-After dice cuántos segundos esperar", async () => {
    backend((c) => (c.method === "POST" ? new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "12" } }) : undefined));
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    await alertaCon(tf("interview.error.rateLimitedIn", { n: 12 }), ESPERA);
  });
  it("409 sesion_en_curso ofrece «Retoma tu entrevista» hacia esa sesión", async () => {
    backend((c) => (c.method === "POST" ? jsonRes(409, { error: "sesion_en_curso", session_id: SID }) : undefined));
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    await alertaCon(t("interview.error.activeSession"), ESPERA);
    expect(screen.getByRole("link", { name: t("interview.start.resumeActive") })).toHaveAttribute("href", `/interviews/${SID}`);
  });
});

/** JB-92: aviso de privacidad solo cuando el servidor dice que la IA redacta (`ai_replies: true`). */
describe("aviso de privacidad de la IA", () => {
  const conIa = (activa: boolean | undefined) =>
    backend((c) => (c.url === "/api/recruiters" ? jsonRes(200, { ...items(RECRUITERS), ...(activa === undefined ? {} : { ai_replies: activa }) }) : undefined));

  for (const [nombre, valor] of [["false", false], ["ausente", undefined]] as const) {
    it(`con ai_replies ${nombre}: no hay aviso ni casilla y se empieza como siempre`, async () => {
      const { llamadas } = conIa(valor);
      render(<InterviewStart />);
      await elegir();
      expect(screen.queryByText(t("interview.start.ai.notice"))).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      llamadas.length = 0;
      backend((c) => (c.url === "/api/interviews" && c.method === "POST" ? jsonRes(201, SESION()) : undefined));
      fireEvent.click(empezar());
      await vi.waitFor(() => expect(goTo).toHaveBeenCalledWith(`/interviews/${SID}`), ESPERA);
    });
  }

  it("con ai_replies true: muestra el aviso, nombra a OpenRouter y pide la casilla, desmarcada", async () => {
    conIa(true);
    render(<InterviewStart />);
    await elegir();
    const aviso = screen.getByText(t("interview.start.ai.notice"));
    expect(aviso).toHaveTextContent(/OpenRouter/);
    expect(aviso).toHaveTextContent(/datos personales sensibles/);
    const casilla = screen.getByRole("checkbox", { name: t("interview.start.ai.ack") });
    expect(casilla).not.toBeChecked();
    expect(casilla).toBeRequired();
    expect(casilla).toHaveAccessibleDescription(t("interview.start.ai.notice"));
  });

  it("sin marcarla no se empieza: error anunciado, casilla con foco y sin POST", async () => {
    const { llamadas } = conIa(true);
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    const casilla = screen.getByRole("checkbox", { name: t("interview.start.ai.ack") });
    const error = screen.getByText(t("interview.start.validation.ai"));
    expect(error).toBeInTheDocument();
    expect(casilla).toHaveAttribute("aria-invalid", "true");
    expect(casilla).toHaveAccessibleDescription(new RegExp(t("interview.start.validation.ai")));
    expect(casilla).toHaveFocus();
    expect(posts(llamadas)).toHaveLength(0);
  });

  it("al marcarla desaparece el error y se empieza una sola vez (teclado: Espacio la alterna)", async () => {
    const { llamadas } = backend((c) => {
      if (c.url === "/api/recruiters") return jsonRes(200, { ...items(RECRUITERS), ai_replies: true });
      if (c.url === "/api/interviews" && c.method === "POST") return jsonRes(201, SESION());
      return undefined;
    });
    render(<InterviewStart />);
    await elegir();
    fireEvent.click(empezar());
    const casilla = screen.getByRole("checkbox", { name: t("interview.start.ai.ack") });
    fireEvent.click(casilla); // lo mismo que hace Espacio sobre una casilla nativa
    expect(casilla).toBeChecked();
    expect(screen.queryByText(t("interview.start.validation.ai"))).not.toBeInTheDocument();
    fireEvent.click(empezar());
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledWith(`/interviews/${SID}`), ESPERA);
    expect(posts(llamadas)).toHaveLength(1);
  });
});
