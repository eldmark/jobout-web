/** F8–F10: borrado de cuenta con confirmación. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { jsonRes, stubFetch } from "./helpers/backend";
import { t } from "@/lib/messages";
import { goTo } from "@/lib/navigate";
import DeleteAccount from "@/app/_components/DeleteAccount";
import Adios from "@/app/adios/page";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const abrir = () => fireEvent.click(screen.getByRole("button", { name: t("account.delete.open") }));
const confirmar = () => within(screen.getByRole("dialog")).getByRole("button", { name: t("account.delete.confirm") });
const escribirClave = (v: string) =>
  fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(t("auth.field.password"), { exact: false }), { target: { value: v } });

describe("borrar mi cuenta", () => {
  it("F8: el primer clic NO llama a la API; abre un diálogo que dice qué se pierde", () => {
    const { fn } = stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    expect(screen.queryByRole("dialog")).toBeNull();
    abrir();
    expect(fn).not.toHaveBeenCalled();
    const d = screen.getByRole("dialog");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d).toHaveAccessibleName(t("account.delete.title"));
    expect(d).toHaveTextContent(t("account.delete.warning"));
    expect(d).toHaveTextContent(t("account.delete.lossProfile"));
    expect(d).toHaveTextContent(t("account.delete.lossHistory"));
    expect(d).toHaveTextContent(t("account.delete.irreversible"));
  });
  it("el foco entra al diálogo (campo de contraseña) y Escape lo cierra devolviendo el foco", () => {
    stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    abrir();
    expect(within(screen.getByRole("dialog")).getByLabelText(t("auth.field.password"), { exact: false })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: t("account.delete.open") })).toHaveFocus();
  });
  it("Cancelar cierra sin llamar a la API", () => {
    const { fn } = stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    abrir();
    fireEvent.click(screen.getByRole("button", { name: t("account.delete.cancel") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
  it("F9: confirmar está deshabilitado hasta escribir la contraseña", () => {
    stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    abrir();
    expect(confirmar()).toBeDisabled();
    escribirClave("una-clave-larga");
    expect(confirmar()).toBeEnabled();
    escribirClave("");
    expect(confirmar()).toBeDisabled();
  });
  it("F9: confirmar llama a DELETE una sola vez aunque se haga doble clic, y va a la despedida", async () => {
    const { fn, llamadas } = stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    const b = confirmar();
    fireEvent.click(b);
    fireEvent.click(b);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/adios"));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(llamadas[0]).toMatchObject({ url: "/api/account", method: "DELETE", body: { password: "una-clave-larga" } });
  });
  it("F10: contraseña incorrecta (403) -> mensaje en español, la cuenta no se da por borrada", async () => {
    stubFetch(() => jsonRes(403, { error: "contrasena_incorrecta" }));
    render(<DeleteAccount />);
    abrir();
    escribirClave("mala-mala-mala");
    fireEvent.click(confirmar());
    const alerta = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alerta).toHaveTextContent(t("account.delete.wrongPassword"));
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(confirmar()).toBeEnabled(); // puede reintentar
  });
  it.each([[500], [502], [401]])("F10: error %i -> mensaje genérico y sin navegar", async (status) => {
    stubFetch(() => jsonRes(status, {}));
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    fireEvent.click(confirmar());
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(t("account.delete.failed"));
    expect(goTo).not.toHaveBeenCalled();
  });
  it("F10: fallo de red -> mensaje genérico y sin navegar", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    fireEvent.click(confirmar());
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(t("account.delete.failed"));
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe("/adios", () => {
  it("confirma el borrado y enlaza a /sign-up", () => {
    render(<Adios />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("goodbye.title"));
    expect(screen.getByRole("link", { name: t("goodbye.cta") })).toHaveAttribute("href", "/sign-up");
  });
});
