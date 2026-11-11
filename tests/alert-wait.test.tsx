/**
 * BUG-007: por qué fallaban a veces `sign-forms` e `interview-start`.
 *
 * Los formularios dejan su `role="alert"` siempre en el DOM (vacío hasta que hay un error) para que el
 * lector de pantalla anuncie el cambio. Entonces `findByRole("alert")` lo encuentra al instante y un
 * `toHaveTextContent` inmediato depende de que la respuesta simulada ya haya llegado: bajo carga, no.
 * `alertaCon` espera el **texto**, no la aparición.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { alertaCon } from "./helpers/alerta";
import { t } from "@/lib/messages";
import SignUpPage from "@/app/sign-up/page";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const campo = (k: Parameters<typeof t>[0]) => screen.getByLabelText(t(k), { exact: false });

function llenarYEnviar() {
  fireEvent.change(campo("auth.field.firstName"), { target: { value: "Ana" } });
  fireEvent.change(campo("auth.field.lastName"), { target: { value: "Paz" } });
  fireEvent.change(campo("auth.field.email"), { target: { value: "ana@mail.com" } });
  fireEvent.change(campo("auth.field.password"), { target: { value: "una-clave-larga" } });
  fireEvent.click(screen.getByRole("button", { name: t("auth.signUp.submit") }));
}

/** Una respuesta que tarda: lo que pasa cuando la máquina está cargada. */
const tarde = (r: Response, ms = 40) => new Promise<Response>((ok) => setTimeout(() => ok(r), ms));

describe("BUG-007: esperar el texto de la alerta, no su aparición", () => {
  it("la alerta del formulario existe vacía antes de cualquier respuesta (la causa)", () => {
    render(<SignUpPage />);
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("alertaCon espera aunque la respuesta tarde", async () => {
    stubFetch(() => tarde(jsonRes(422, { error: "datos_invalidos" })));
    render(<SignUpPage />);
    llenarYEnviar();
    const alerta = await alertaCon(t("auth.error.invalidData"));
    expect(alerta).toHaveTextContent(t("auth.error.invalidData"));
    expect(screen.getByRole("button", { name: t("auth.signUp.submit") })).toBeEnabled();
  });

  it("con la respuesta lenta, mirar la alerta en cuanto aparece no ve el texto (el patrón viejo)", async () => {
    stubFetch(() => tarde(jsonRes(422, { error: "datos_invalidos" })));
    render(<SignUpPage />);
    llenarYEnviar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).not.toHaveTextContent(t("auth.error.invalidData"));
    await alertaCon(t("auth.error.invalidData"));
  });

  it("alertaCon falla con un mensaje claro si el texto nunca llega", async () => {
    stubFetch(() => tarde(jsonRes(422, { error: "datos_invalidos" })));
    render(<SignUpPage />);
    llenarYEnviar();
    await expect(alertaCon("un texto que no existe", { timeout: 200 })).rejects.toThrow();
  });
});
