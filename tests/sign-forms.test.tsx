/** F7 + ingreso: validación en cliente, errores amigables, accesibilidad. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import SignUpPage from "@/app/sign-up/page";
import SignInPage from "@/app/sign-in/page";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const campo = (k: Parameters<typeof t>[0]) => screen.getByLabelText(t(k), { exact: false });
function llenarRegistro(o: Partial<Record<"n" | "a" | "e" | "p", string>> = {}) {
  fireEvent.change(campo("auth.field.firstName"), { target: { value: o.n ?? "Ana" } });
  fireEvent.change(campo("auth.field.lastName"), { target: { value: o.a ?? "Paz" } });
  fireEvent.change(campo("auth.field.email"), { target: { value: o.e ?? "ana@mail.com" } });
  fireEvent.change(campo("auth.field.password"), { target: { value: o.p ?? "una-clave-larga" } });
}
const enviar = (k: Parameters<typeof t>[0]) => fireEvent.click(screen.getByRole("button", { name: t(k) }));

describe("/sign-up (F7)", () => {
  it("tiene h1 y enlace a /sign-in", () => {
    render(<SignUpPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("auth.signUp.title"));
    expect(screen.getByRole("link", { name: t("auth.link.toSignIn") })).toHaveAttribute("href", "/sign-in");
  });
  it("valida en el cliente: email inválido y contraseña corta, sin llamar a la API", async () => {
    const { fn } = stubFetch(() => jsonRes(200));
    render(<SignUpPage />);
    llenarRegistro({ e: "no-es-correo", p: "corta" });
    enviar("auth.signUp.submit");
    expect(await screen.findByText(t("auth.validation.email"))).toBeInTheDocument();
    expect(screen.getByText(t("auth.validation.passwordShort"))).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
    expect(campo("auth.field.email")).toHaveAttribute("aria-invalid", "true");
    expect(campo("auth.field.password")).toHaveAttribute("aria-invalid", "true");
  });
  it("campos vacíos: pide cada uno y el foco va al primero inválido", async () => {
    stubFetch(() => jsonRes(200));
    render(<SignUpPage />);
    enviar("auth.signUp.submit");
    expect((await screen.findAllByText(t("auth.validation.required"))).length).toBe(4);
    expect(campo("auth.field.firstName")).toHaveFocus();
  });
  it("10 caracteres exactos pasan; envía a /api/auth/register y va a /dashboard", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, { ok: true }));
    render(<SignUpPage />);
    llenarRegistro({ p: "1234567890" });
    enviar("auth.signUp.submit");
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/dashboard"));
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatchObject({
      url: "/api/auth/register",
      method: "POST",
      body: { email: "ana@mail.com", password: "1234567890", first_name: "Ana", last_name: "Paz" },
    });
  });
  it("409: muestra solo el mensaje genérico, en un aria-live, sin nombrar el correo", async () => {
    stubFetch(() => jsonRes(409, { error: "registro_no_disponible" }));
    render(<SignUpPage />);
    llenarRegistro();
    enviar("auth.signUp.submit");
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(t("auth.error.registerUnavailable"));
    expect(alerta.textContent).not.toMatch(/ana@mail\.com|ya existe|registrado/i);
    expect(alerta).toHaveAttribute("aria-live");
    expect(goTo).not.toHaveBeenCalled();
  });
  it("422 y fallo de red tienen su mensaje; el botón se rehabilita", async () => {
    stubFetch(() => jsonRes(422, { error: "datos_invalidos" }));
    render(<SignUpPage />);
    llenarRegistro();
    enviar("auth.signUp.submit");
    expect(await screen.findByRole("alert")).toHaveTextContent(t("auth.error.invalidData"));
    cleanup();
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(<SignUpPage />);
    llenarRegistro();
    enviar("auth.signUp.submit");
    expect(await screen.findByRole("alert")).toHaveTextContent(t("auth.error.generic"));
    expect(screen.getByRole("button", { name: t("auth.signUp.submit") })).toBeEnabled();
  });
  it("doble envío rápido llama una sola vez", async () => {
    const { fn } = stubFetch(() => jsonRes(200, { ok: true }));
    render(<SignUpPage />);
    llenarRegistro();
    const b = screen.getByRole("button", { name: t("auth.signUp.submit") });
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(goTo).toHaveBeenCalled());
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("los campos tienen autocomplete adecuado y la contraseña es type=password", () => {
    render(<SignUpPage />);
    expect(campo("auth.field.email")).toHaveAttribute("autocomplete", "email");
    expect(campo("auth.field.password")).toHaveAttribute("autocomplete", "new-password");
    expect(campo("auth.field.password")).toHaveAttribute("type", "password");
  });
});

describe("/sign-in", () => {
  const entrar = (e = "ana@mail.com", p = "una-clave-larga") => {
    fireEvent.change(campo("auth.field.email"), { target: { value: e } });
    fireEvent.change(campo("auth.field.password"), { target: { value: p } });
    enviar("auth.signIn.submit");
  };
  it("tiene h1 y enlace a /sign-up", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("auth.signIn.title"));
    expect(screen.getByRole("link", { name: t("auth.link.toSignUp") })).toHaveAttribute("href", "/sign-up");
    expect(campo("auth.field.password")).toHaveAttribute("autocomplete", "current-password");
  });
  it("valida email y contraseña vacía en el cliente", async () => {
    const { fn } = stubFetch(() => jsonRes(200));
    render(<SignInPage />);
    entrar("xx", "");
    expect(await screen.findByText(t("auth.validation.email"))).toBeInTheDocument();
    expect(screen.getByText(t("auth.validation.required"))).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
  it("éxito: POST a /api/auth/login y va a /dashboard", async () => {
    const { llamadas } = stubFetch(() => jsonRes(200, { ok: true }));
    render(<SignInPage />);
    entrar();
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/dashboard"));
    expect(llamadas[0]).toMatchObject({ url: "/api/auth/login", body: { email: "ana@mail.com", password: "una-clave-larga" } });
  });
  it.each([
    [401, "credenciales_invalidas", "auth.error.invalidCredentials"],
    [403, "cuenta_no_disponible", "auth.error.accountUnavailable"],
    [429, "demasiados_intentos", "auth.error.tooManyAttempts"],
    [422, "datos_invalidos", "auth.error.invalidData"],
  ] as const)("%i muestra su mensaje en español", async (status, error, key) => {
    stubFetch(() => jsonRes(status, { error }));
    render(<SignInPage />);
    entrar();
    expect(await screen.findByRole("alert")).toHaveTextContent(t(key));
  });
  it("401 no distingue entre correo inexistente y contraseña mala", () => {
    expect(t("auth.error.invalidCredentials")).not.toMatch(/no existe|no registrado|no encontr/i);
  });
});
