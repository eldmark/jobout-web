/** F3 (primera pregunta), F4–F8, F13 y F14 en la conversación. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { dobleClic } from "./helpers/doble";
import { jsonRes, stubFetch, type Llamada } from "./helpers/backend";
import { SID, SESION, SCORE, T1, RESP } from "./helpers/interview";
import { t, tf } from "@/lib/messages";
import InterviewRoom from "@/app/_components/InterviewRoom";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
const ESPERA = { timeout: 5000 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const RESPUESTA = { turn: { seq: 3, speaker: "recruiter", kind: "follow_up", text: "¿Qué resultado medible tuvo?" }, done: false };
type Manejador = (c: Llamada) => Response | Promise<Response> | undefined;

function backend(extra: Manejador = () => undefined, sesion: unknown = SESION()) {
  return stubFetch((c) => {
    const x = extra(c);
    if (x) return x;
    if (c.method === "GET" && c.url === `/api/interviews/${SID}`) return jsonRes(200, sesion);
    if (c.method === "GET" && c.url === `/api/interviews/${SID}/score`) return jsonRes(200, SCORE());
    return jsonRes(404);
  });
}
/** Tras un resume exitoso, el backend ya devuelve la sesión en curso. */
function reanudable(): Manejador {
  let activa = false;
  return (c) => {
    if (c.method === "POST" && c.url.endsWith("/resume")) {
      activa = true;
      return jsonRes(200, { turn: T1 });
    }
    if (activa && c.method === "GET" && c.url === `/api/interviews/${SID}`) return jsonRes(200, SESION());
  };
}
const llamadasA = (ll: Llamada[], sufijo: string) => ll.filter((c) => c.method === "POST" && c.url.endsWith(sufijo));
const campo = () => screen.getByRole("textbox", { name: t("interview.room.answerLabel") }) as HTMLTextAreaElement;
const enviarBtn = () => screen.getByRole("button", { name: t("interview.room.send") });
const escribir = (v: string) => fireEvent.change(campo(), { target: { value: v } });
async function abrir(extra?: Manejador, sesion?: unknown) {
  const b = backend(extra, sesion);
  render(<InterviewRoom id={SID} />);
  await screen.findByRole("textbox", { name: t("interview.room.answerLabel") }, ESPERA);
  return b;
}

describe("práctica de una oferta (HU-31)", () => {
  it("si la sesión está vinculada a una oferta, dice «Practicando: título» arriba de la conversación", async () => {
    await abrir(undefined, SESION({ offer: { id: "66666666-6666-4666-8666-666666666666", title: "Desarrollador backend", company_name: "Café Nuevo S.A." } }));
    const aviso = screen.getByText(tf("interview.room.practicing", { title: "Desarrollador backend" }));
    expect(aviso).toBeInTheDocument();
    expect(aviso.compareDocumentPosition(campo()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("con una oferta confidencial (sin empresa) también, y el título se pinta como texto, no como HTML", async () => {
    await abrir(undefined, SESION({ offer: { id: "66666666-6666-4666-8666-666666666666", title: "<b>Gerente</b>", company_name: null } }));
    const aviso = screen.getByText(tf("interview.room.practicing", { title: "<b>Gerente</b>" }));
    expect(aviso.querySelector("b")).toBeNull();
    expect(screen.getByRole("main")).not.toHaveTextContent("null");
  });
  it("sin oferta no aparece nada de práctica", async () => {
    await abrir();
    expect(screen.queryByText(/Practicando:/)).toBeNull();
  });
});

describe("carga (tres estados)", () => {
  it("muestra cargando y luego la sesión", async () => {
    backend();
    render(<InterviewRoom id={SID} />);
    expect(screen.getByRole("status")).toHaveTextContent(t("interview.room.loading"));
    expect(await screen.findByRole("heading", { level: 1, name: /Ana/ }, ESPERA)).toBeInTheDocument();
  });
  it("si falla, error anunciado con reintento", async () => {
    let falla = true;
    backend((c) => (falla && c.method === "GET" ? jsonRes(502, { error: "servicio_no_disponible" }) : undefined));
    render(<InterviewRoom id={SID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.room.loadError"));
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.retry") }));
    expect(await screen.findByRole("textbox", { name: t("interview.room.answerLabel") }, ESPERA)).toBeInTheDocument();
    // Dos esperas de hasta 5 s cada una no caben en el tope de 5 s por prueba: el tope tiene que cubrirlas.
  }, 3 * ESPERA.timeout);
  it("404 -> «no encontramos esa entrevista»", async () => {
    backend((c) => (c.method === "GET" ? jsonRes(404, { error: "no_encontrado" }) : undefined));
    render(<InterviewRoom id={SID} />);
    expect(await screen.findByRole("alert", {}, ESPERA)).toHaveTextContent(t("interview.error.notFound"));
  });
});

describe("F3/F4 la conversación", () => {
  it("muestra la primera pregunta y los turnos en orden por seq", async () => {
    await abrir(undefined, SESION({
      turns: [
        RESP(2, "Hice una API"),
        T1,
        { seq: 3, speaker: "recruiter", kind: "follow_up", text: "¿Con qué resultado?" },
      ],
    }));
    const lista = screen.getByRole("list", { name: t("interview.room.transcript") });
    const items = within(lista).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining(T1.text),
      expect.stringContaining("Hice una API"),
      expect.stringContaining("¿Con qué resultado?"),
    ]);
    expect(items[0]).toHaveTextContent("Ana");
    expect(items[1]).toHaveTextContent(t("interview.room.you"));
  });
  it("el último mensaje del recruiter se anuncia en una región aria-live", async () => {
    await abrir();
    const vivo = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(vivo).not.toBeNull();
    expect(vivo).toHaveTextContent(T1.text);
  });
  it("tras una respuesta, la región viva lleva el mensaje nuevo del recruiter y no el de la persona", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir("Hice una API de pagos");
    fireEvent.click(enviarBtn());
    await screen.findByText(RESPUESTA.turn.text, { selector: "li *, li" }, ESPERA);
    const vivo = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(vivo).toHaveTextContent(RESPUESTA.turn.text);
    expect(vivo).not.toHaveTextContent("Hice una API de pagos");
  });
  it("el estado es visible siempre: te toca responder", async () => {
    await abrir();
    expect(screen.getByText(t("interview.room.status.yourTurn"))).toBeInTheDocument();
  });
  it("el campo recibe el foco al abrir", async () => {
    await abrir();
    // El foco lo mueve un efecto que corre después de pintar: se espera, no se supone.
    await waitFor(() => expect(campo()).toHaveFocus(), ESPERA);
  });
});

describe("avatar del entrevistador", () => {
  const estadoAvatar = () => document.querySelector(".avatar")?.getAttribute("data-state");
  it("es decorativo (aria-hidden) y habla la pregunta inicial al entrar", async () => {
    await abrir();
    expect(document.querySelector(".avatar canvas")).toHaveAttribute("aria-hidden", "true");
    expect(estadoAvatar()).toBe("speaking");
  });
  it("piensa mientras se espera al recruiter y habla cuando llega su turno", async () => {
    let soltar: (r: Response) => void = () => {};
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? new Promise<Response>((r) => (soltar = r)) : undefined));
    escribir("Hice una API de pagos");
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(estadoAvatar()).toBe("thinking"), ESPERA);
    soltar(jsonRes(201, RESPUESTA));
    await waitFor(() => expect(estadoAvatar()).toBe("speaking"), ESPERA);
  });
});

describe("F5 enviar", () => {
  it("con el botón: POST {text}, el campo se vacía y se deshabilita mientras espera, y se habilita al volver", async () => {
    let soltar: (r: Response) => void = () => {};
    const { llamadas } = await abrir((c) =>
      c.method === "POST" && c.url.endsWith("/turns") ? (new Promise<Response>((res) => (soltar = res)) as Promise<Response>) : undefined,
    );
    escribir("  Hice una API de pagos  ");
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(campo()).toBeDisabled(), ESPERA);
    expect(campo()).toHaveValue("");
    expect(screen.getByRole("button", { name: t("interview.room.sending") })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(tf("interview.room.status.thinking", { name: "Ana" }));
    expect(llamadasA(llamadas, "/turns")).toHaveLength(1);
    expect(llamadasA(llamadas, "/turns")[0].body).toEqual({ text: "Hice una API de pagos" });
    soltar(jsonRes(201, RESPUESTA));
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
    // El foco lo mueve un efecto que corre después de pintar: se espera, no se supone.
    await waitFor(() => expect(campo()).toHaveFocus(), ESPERA);
    expect(screen.queryByText(tf("interview.room.status.thinking", { name: "Ana" }))).toBeNull();
  });
  it("con Ctrl+Enter (y Cmd+Enter) envía; Enter solo no envía", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir("Primera");
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(llamadasA(llamadas, "/turns")).toHaveLength(0);
    fireEvent.keyDown(campo(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(llamadasA(llamadas, "/turns")).toHaveLength(1), ESPERA);
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
    escribir("Segunda");
    fireEvent.keyDown(campo(), { key: "Enter", metaKey: true });
    await waitFor(() => expect(llamadasA(llamadas, "/turns")).toHaveLength(2), ESPERA);
  });
  it("doble envío rápido -> una sola llamada", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir("Una respuesta");
    const b = enviarBtn();
    dobleClic(b);
    fireEvent.keyDown(campo(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
    expect(llamadasA(llamadas, "/turns")).toHaveLength(1);
  });
  it("tu respuesta aparece en la transcripción y la del recruiter después", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir("Mi historia");
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
    const items = within(screen.getByRole("list", { name: t("interview.room.transcript") })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining(T1.text),
      expect.stringContaining("Mi historia"),
      expect.stringContaining(RESPUESTA.turn.text),
    ]);
  });
});

describe("F6 respuesta vacía", () => {
  for (const v of ["", "   ", "\n\t \n"]) {
    it(`«${JSON.stringify(v)}» no se envía, se explica y el foco vuelve al campo`, async () => {
      const { llamadas } = await abrir();
      escribir(v);
      (document.body as HTMLElement).focus();
      fireEvent.click(enviarBtn());
      expect(llamadasA(llamadas, "/turns")).toHaveLength(0);
      expect(campo()).toHaveAttribute("aria-invalid", "true");
      expect(campo()).toHaveAccessibleDescription(expect.stringContaining(t("interview.room.validation.empty")));
      expect(campo()).toHaveFocus();
    });
  }
  it("el error se limpia al escribir", async () => {
    await abrir();
    fireEvent.click(enviarBtn());
    expect(screen.getByText(t("interview.room.validation.empty"))).toBeInTheDocument();
    escribir("a");
    expect(screen.queryByText(t("interview.room.validation.empty"))).toBeNull();
    expect(campo()).not.toHaveAttribute("aria-invalid");
  });
  it("un texto de más de 4000 caracteres no se envía y se explica", async () => {
    const { llamadas } = await abrir();
    escribir("a".repeat(4001));
    fireEvent.click(enviarBtn());
    expect(llamadasA(llamadas, "/turns")).toHaveLength(0);
    expect(screen.getByText(t("interview.room.validation.tooLong"))).toBeInTheDocument();
    expect(campo()).toHaveFocus();
  });
  it("el límite cuenta caracteres Unicode: 4000 emojis (8000 unidades UTF-16) sí se envían; 4001 no", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    expect(campo()).not.toHaveAttribute("maxlength"); // maxlength cuenta UTF-16 y rechazaría texto válido
    escribir("😀".repeat(4001));
    fireEvent.click(enviarBtn());
    expect(llamadasA(llamadas, "/turns")).toHaveLength(0);
    expect(screen.getByText(t("interview.room.validation.tooLong"))).toBeInTheDocument();
    escribir("😀".repeat(4000));
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(llamadasA(llamadas, "/turns")).toHaveLength(1), ESPERA);
    expect((llamadasA(llamadas, "/turns")[0].body as { text: string }).text).toBe("😀".repeat(4000));
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
  });
  it("el recorte va antes de contar: 4000 caracteres rodeados de espacios sí se envían", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir(`   ${"a".repeat(4000)}  \n`);
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(llamadasA(llamadas, "/turns")).toHaveLength(1), ESPERA);
    expect((llamadasA(llamadas, "/turns")[0].body as { text: string }).text).toBe("a".repeat(4000));
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
  });
});

describe("F7 fallos y reintento sin perder lo escrito", () => {
  it("si falla (503): mensaje en español anunciado, el texto vuelve al campo y se reintenta", async () => {
    let falla = true;
    const { llamadas } = await abrir((c) => {
      if (c.method === "POST" && c.url.endsWith("/turns")) return falla ? jsonRes(503, { error: "motor_no_disponible" }) : jsonRes(201, RESPUESTA);
    });
    escribir("Mi respuesta larga e importante");
    fireEvent.click(enviarBtn());
    const alerta = await screen.findByText(t("interview.error.engineDown"), {}, ESPERA);
    expect(alerta.closest('[role="alert"]')).not.toBeNull();
    expect(campo()).toHaveValue("Mi respuesta larga e importante");
    expect(campo()).toBeEnabled();
    // El foco lo mueve un efecto que corre después de pintar: se espera, no se supone.
    await waitFor(() => expect(campo()).toHaveFocus(), ESPERA);
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.retrySend") }));
    await screen.findByText(RESPUESTA.turn.text, { selector: "li *, li" }, ESPERA);
    expect(llamadasA(llamadas, "/turns").map((c) => (c.body as { text: string }).text)).toEqual([
      "Mi respuesta larga e importante",
      "Mi respuesta larga e importante",
    ]);
    expect(screen.queryByText(t("interview.error.engineDown"))).toBeNull();
    expect(campo()).toHaveValue("");
  });
  it("lo que se editó tras el fallo es lo que se reenvía", async () => {
    let falla = true;
    const { llamadas } = await abrir((c) => {
      if (c.method === "POST" && c.url.endsWith("/turns")) return falla ? jsonRes(503, { error: "motor_no_disponible" }) : jsonRes(201, RESPUESTA);
    });
    escribir("Borrador");
    fireEvent.click(enviarBtn());
    await screen.findByText(t("interview.error.engineDown"), {}, ESPERA);
    escribir("Borrador mejorado");
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.retrySend") }));
    await waitFor(() => expect(llamadasA(llamadas, "/turns")).toHaveLength(2), ESPERA);
    expect((llamadasA(llamadas, "/turns")[1].body as { text: string }).text).toBe("Borrador mejorado");
  });
  it("tu mensaje fallido no queda en la transcripción", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(503, { error: "motor_no_disponible" }) : undefined));
    escribir("No se guardó");
    fireEvent.click(enviarBtn());
    await screen.findByText(t("interview.error.engineDown"), {}, ESPERA);
    expect(within(screen.getByRole("list", { name: t("interview.room.transcript") })).queryByText("No se guardó")).toBeNull();
  });
  const casos: [number, unknown, string][] = [
    [429, { error: "demasiados_intentos" }, "interview.error.rateLimited"],
    [409, { error: "turno_en_proceso" }, "interview.error.turnInProgress"],
    [409, { error: "estado_invalido" }, "interview.error.state"],
    [422, { error: "datos_invalidos" }, "interview.error.invalid"],
    [403, { error: "cuenta_no_disponible" }, "interview.error.forbidden"],
    [502, { error: "servicio_no_disponible" }, "interview.error.generic"],
  ];
  for (const [estado, cuerpo, clave] of casos) {
    it(`F13 ${estado} -> ${clave} y el texto no se pierde`, async () => {
      await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(estado, cuerpo) : undefined));
      escribir("Texto que no debe perderse");
      fireEvent.click(enviarBtn());
      expect(await screen.findByText(t(clave as Parameters<typeof t>[0]), {}, ESPERA)).toBeInTheDocument();
      expect(campo()).toHaveValue("Texto que no debe perderse");
    });
  }
  it("429 con Retry-After dice cuántos segundos esperar y el texto no se pierde", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? new Response(JSON.stringify({ error: "demasiados_intentos" }), { status: 429, headers: { "retry-after": "9" } }) : undefined));
    escribir("Mi texto");
    fireEvent.click(enviarBtn());
    expect(await screen.findByText(tf("interview.error.rateLimitedIn", { n: 9 }), {}, ESPERA)).toBeInTheDocument();
    expect(campo()).toHaveValue("Mi texto");
  });
  it("fallo de red -> mensaje genérico y el texto se conserva", async () => {
    await abrir((c) => {
      if (c.method === "POST") throw new Error("offline");
      return undefined;
    });
    escribir("Sin red");
    fireEvent.click(enviarBtn());
    expect(await screen.findByText(t("interview.error.generic"), {}, ESPERA)).toBeInTheDocument();
    expect(campo()).toHaveValue("Sin red");
  });
});

describe("cierre automático (done)", () => {
  const CIERRE = { turn: { seq: 9, speaker: "recruiter", kind: "closing", text: "Gracias, terminamos." }, done: true };
  it("done:true = la sesión ya está completada: el cliente pide el score con GET .../score (la respuesta no lo trae)", async () => {
    const { llamadas } = await abrir((c) => {
      if (c.method === "POST" && c.url.endsWith("/turns")) return jsonRes(201, CIERRE);
      if (c.method === "GET" && c.url.endsWith("/score")) return jsonRes(200, SCORE({ score: 91 }));
    });
    escribir("Última");
    fireEvent.click(enviarBtn());
    expect(await screen.findByRole("heading", { name: t("interview.result.title") }, ESPERA)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(t("interview.result.score")).closest("div")).toHaveTextContent("91"), ESPERA);
    const orden = llamadas.map((c) => `${c.method} ${c.url.replace(`/api/interviews/${SID}`, "")}`);
    expect(orden.filter((o) => o === "GET /score")).toHaveLength(1);
    expect(orden.indexOf("GET /score")).toBeGreaterThan(orden.indexOf("POST /turns"));
    expect(orden.some((o) => o.endsWith("/finish"))).toBe(false); // ya está completada: no se llama a finish
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("done:false sigue la conversación y no pide el score", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/turns") ? jsonRes(201, RESPUESTA) : undefined));
    escribir("Una");
    fireEvent.click(enviarBtn());
    await waitFor(() => expect(campo()).toBeEnabled(), ESPERA);
    expect(llamadas.some((c) => c.url.endsWith("/score"))).toBe(false);
    expect(screen.queryByRole("heading", { name: t("interview.result.title") })).toBeNull();
  });
  it("si el GET del score falla tras done, se ofrece reintentar sin perder la sesión cerrada", async () => {
    let falla = true;
    await abrir((c) => {
      if (c.method === "POST" && c.url.endsWith("/turns")) return jsonRes(201, CIERRE);
      if (c.method === "GET" && c.url.endsWith("/score")) return falla ? jsonRes(502, { error: "servicio_no_disponible" }) : jsonRes(200, SCORE());
    });
    escribir("Última");
    fireEvent.click(enviarBtn());
    expect(await screen.findByText(t("interview.result.loadError"), {}, ESPERA)).toBeInTheDocument();
    falla = false;
    fireEvent.click(screen.getByRole("button", { name: t("interview.result.retry") }));
    expect(await screen.findByRole("heading", { name: t("interview.result.title") }, ESPERA)).toBeInTheDocument();
  });
});

describe("F8 pausar, retomar, abandonar y terminar", () => {
  it("Pausar: el primer clic NO llama a la API y abre un diálogo que explica los 7 días", async () => {
    const { llamadas } = await abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.pause") }));
    const d = screen.getByRole("dialog");
    expect(d).toHaveAccessibleName(t("interview.pause.title"));
    expect(d).toHaveTextContent(t("interview.pause.expires"));
    expect(llamadasA(llamadas, "/pause")).toHaveLength(0);
    fireEvent.click(within(d).getByRole("button", { name: t("interview.pause.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(llamadasA(llamadas, "/pause")).toHaveLength(0);
    expect(screen.getByRole("button", { name: t("interview.room.pause") })).toHaveFocus();
  });
  it("Pausar con una respuesta a medias avisa que no se guarda", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.pause") }));
    expect(screen.getByRole("dialog")).not.toHaveTextContent(t("interview.pause.draft"));
    fireEvent.click(screen.getByRole("button", { name: t("interview.pause.cancel") }));
    escribir("A medias");
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.pause") }));
    expect(screen.getByRole("dialog")).toHaveTextContent(t("interview.pause.draft"));
  });
  it("confirmar pausa llama una sola vez (doble clic) y muestra la pausa con «Retomar»", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/pause") ? jsonRes(204) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.pause") }));
    const ok = screen.getByRole("button", { name: t("interview.pause.confirm") });
    dobleClic(ok);
    expect(await screen.findByRole("heading", { name: t("interview.paused.title") }, ESPERA)).toBeInTheDocument();
    expect(llamadasA(llamadas, "/pause")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(t("interview.room.status.paused"))).toBeInTheDocument();
  });
  it("si la pausa falla, el diálogo sigue abierto con el error en español", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/pause") ? jsonRes(409, { error: "estado_invalido" }) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.pause") }));
    fireEvent.click(screen.getByRole("button", { name: t("interview.pause.confirm") }));
    const d = screen.getByRole("dialog");
    expect(await within(d).findByText(t("interview.error.state"), {}, ESPERA)).toBeInTheDocument();
  });
  it("una sesión pausada se abre en pausa; Retomar llama a resume y vuelve a la conversación", async () => {
    const { llamadas } = backend(reanudable(), SESION({ status: "paused" }));
    render(<InterviewRoom id={SID} />);
    const retomar = await screen.findByRole("button", { name: t("interview.room.resume") }, ESPERA);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(retomar);
    expect(await screen.findByRole("textbox", { name: t("interview.room.answerLabel") }, ESPERA)).toBeInTheDocument();
    expect(llamadasA(llamadas, "/resume")).toHaveLength(1);
    expect(screen.getByRole("list", { name: t("interview.room.transcript") })).toHaveTextContent(T1.text);
  });
  it("Retomar: doble clic -> una sola llamada", async () => {
    const { llamadas } = backend(reanudable(), SESION({ status: "paused" }));
    render(<InterviewRoom id={SID} />);
    const retomar = await screen.findByRole("button", { name: t("interview.room.resume") }, ESPERA);
    dobleClic(retomar);
    await screen.findByRole("textbox", {}, ESPERA);
    expect(llamadasA(llamadas, "/resume")).toHaveLength(1);
  });
  it("Retomar con un error de otro tipo (503) lo explica en español", async () => {
    backend((c) => (c.method === "POST" ? jsonRes(503, { error: "motor_no_disponible" }) : undefined), SESION({ status: "paused" }));
    render(<InterviewRoom id={SID} />);
    fireEvent.click(await screen.findByRole("button", { name: t("interview.room.resume") }, ESPERA));
    expect(await screen.findByText(t("interview.error.engineDown"), {}, ESPERA)).toBeInTheDocument();
  });
  it("Retomar sobre una sesión que ya estaba en curso (409 estado_invalido) recarga con GET y sigue la conversación", async () => {
    let enCurso = false;
    const { llamadas } = backend((c) => {
      if (c.method === "POST" && c.url.endsWith("/resume")) {
        enCurso = true; // otra pestaña ya la había retomado
        return jsonRes(409, { error: "estado_invalido" });
      }
      if (enCurso && c.method === "GET" && c.url === `/api/interviews/${SID}`) return jsonRes(200, SESION());
    }, SESION({ status: "paused" }));
    render(<InterviewRoom id={SID} />);
    fireEvent.click(await screen.findByRole("button", { name: t("interview.room.resume") }, ESPERA));
    expect(await screen.findByRole("textbox", { name: t("interview.room.answerLabel") }, ESPERA)).toBeInTheDocument();
    expect(screen.queryByText(t("interview.error.state"))).toBeNull();
    expect(llamadas.filter((c) => c.method === "GET" && c.url === `/api/interviews/${SID}`)).toHaveLength(2);
    expect(llamadasA(llamadas, "/resume")).toHaveLength(1);
  });
  it("si tras el 409 la recarga la muestra abandonada, se ve su aviso (nada de error confuso)", async () => {
    let estado = "paused";
    backend((c) => {
      if (c.method === "POST" && c.url.endsWith("/resume")) {
        estado = "abandoned";
        return jsonRes(409, { error: "estado_invalido" });
      }
      if (c.method === "GET" && c.url === `/api/interviews/${SID}`) return jsonRes(200, SESION({ status: estado }));
    });
    render(<InterviewRoom id={SID} />);
    fireEvent.click(await screen.findByRole("button", { name: t("interview.room.resume") }, ESPERA));
    expect(await screen.findByRole("heading", { name: t("interview.abandoned.title") }, ESPERA)).toBeInTheDocument();
  });
  it("Abandonar: el primer clic NO llama a la API; Cancelar tampoco; confirmar llama una vez", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/abandon") ? jsonRes(204) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.abandon") }));
    const d = screen.getByRole("dialog");
    expect(d).toHaveAccessibleName(t("interview.abandon.title"));
    expect(d).toHaveTextContent(t("interview.abandon.warning"));
    expect(llamadasA(llamadas, "/abandon")).toHaveLength(0);
    fireEvent.click(within(d).getByRole("button", { name: t("interview.abandon.cancel") }));
    expect(llamadasA(llamadas, "/abandon")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: t("interview.room.abandon") }));
    const ok = screen.getByRole("button", { name: t("interview.abandon.confirm") });
    dobleClic(ok);
    expect(await screen.findByRole("heading", { name: t("interview.abandoned.title") }, ESPERA)).toBeInTheDocument();
    expect(llamadasA(llamadas, "/abandon")).toHaveLength(1);
    expect(screen.getByRole("link", { name: t("interview.result.practiceAgain") })).toHaveAttribute("href", "/interviews");
  });
  it("Escape cierra el diálogo sin llamar a la API", async () => {
    const { llamadas } = await abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.abandon") }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(llamadasA(llamadas, "/abandon")).toHaveLength(0);
  });
  it("Terminar pide confirmación; confirmar llama a finish una vez y muestra el resultado", async () => {
    const { llamadas } = await abrir((c) => (c.method === "POST" && c.url.endsWith("/finish") ? jsonRes(200, SCORE()) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.finish") }));
    expect(llamadasA(llamadas, "/finish")).toHaveLength(0);
    const ok = screen.getByRole("button", { name: t("interview.finish.confirm") });
    dobleClic(ok);
    expect(await screen.findByRole("heading", { name: t("interview.result.title") }, ESPERA)).toBeInTheDocument();
    expect(llamadasA(llamadas, "/finish")).toHaveLength(1);
    // finish ya devuelve el cuerpo Score (200): no hace falta pedirlo otra vez
    expect(llamadas.some((c) => c.method === "GET" && c.url.endsWith("/score"))).toBe(false);
    expect(screen.getByText(t("interview.result.score")).closest("div")).toHaveTextContent("78");
  });
  it("finish con un 409 estado_invalido lo explica y no muestra resultado", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/finish") ? jsonRes(409, { error: "estado_invalido" }) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.finish") }));
    fireEvent.click(screen.getByRole("button", { name: t("interview.finish.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByText(t("interview.error.state"), {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: t("interview.result.title") })).toBeNull();
  });
  it("Terminar con menos de 2 respuestas (422) lo explica y la sesión sigue abierta", async () => {
    await abrir((c) => (c.method === "POST" && c.url.endsWith("/finish") ? jsonRes(422, { error: "entrevista_muy_corta" }) : undefined));
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.finish") }));
    fireEvent.click(screen.getByRole("button", { name: t("interview.finish.confirm") }));
    expect(await within(screen.getByRole("dialog")).findByText(t("interview.error.tooShort"), {}, ESPERA)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("interview.finish.cancel") }));
    expect(campo()).toBeInTheDocument();
  });
  it("una sesión abandonada se abre con su aviso; una terminada, con su resultado", async () => {
    backend(undefined, SESION({ status: "abandoned" }));
    render(<InterviewRoom id={SID} />);
    expect(await screen.findByRole("heading", { name: t("interview.abandoned.title") }, ESPERA)).toBeInTheDocument();
    cleanup();
    backend(undefined, SESION({ status: "completed" }));
    render(<InterviewRoom id={SID} />);
    expect(await screen.findByRole("heading", { name: t("interview.result.title") }, ESPERA)).toBeInTheDocument();
  });
});

describe("F14 teclado y foco", () => {
  it("los diálogos atrapan el foco: empiezan en el botón seguro", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: t("interview.room.abandon") }));
    expect(screen.getByRole("button", { name: t("interview.abandon.cancel") })).toHaveFocus();
  });
  it("todos los controles son nativos (button/textarea), sin tabindex negativo", async () => {
    await abrir();
    expect(document.body.querySelectorAll('[tabindex="-1"]')).toHaveLength(0);
    expect(campo().tagName).toBe("TEXTAREA");
  });
  it("el área de errores es una región de alerta presente desde el inicio (se anuncia al llenarse)", async () => {
    await abrir();
    const region = screen.getAllByRole("alert").find((e) => e.getAttribute("aria-live") === "assertive");
    expect(region).toBeDefined();
  });
});
