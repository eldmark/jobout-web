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
  it("BUG-015: dice qué se queda sin tu nombre (aplicaciones; ofertas y decisiones de quien trabaja en una empresa) y qué más se borra", () => {
    stubFetch(() => jsonRes(204));
    render(<DeleteAccount />);
    abrir();
    const d = screen.getByRole("dialog");
    for (const k of ["account.delete.lossExternal", "account.delete.keeps", "account.delete.keepsApplications", "account.delete.keepsCompany"] as const) {
      expect(d, k).toHaveTextContent(t(k));
    }
    expect(t("account.delete.keepsApplications")).toMatch(/aplicaciones/);
    expect(t("account.delete.keepsApplications")).toMatch(/sin tu nombre/);
    expect(t("account.delete.keepsCompany")).toMatch(/ofertas/);
    expect(t("account.delete.keepsCompany")).toMatch(/decisiones/);
    // El API no promete nada sobre notas internas: el texto tampoco.
    expect(t("account.delete.keepsCompany")).not.toMatch(/notas/i);
    // Lo que se conserva va antes de la advertencia final, dentro de la descripción del diálogo.
    expect(d).toHaveAccessibleDescription(expect.stringContaining(t("account.delete.keepsApplications")));
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
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(t("account.delete.wrongPassword")));
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
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(t("account.delete.failed")));
    expect(goTo).not.toHaveBeenCalled();
  });
  it("BUG-014: 409 ultimo_administrador -> explica qué hacer y qué no se puede todavía, no el mensaje genérico", async () => {
    stubFetch(() => jsonRes(409, { error: "ultimo_administrador" }));
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    fireEvent.click(confirmar());
    const alerta = () => within(screen.getByRole("dialog")).getByRole("alert");
    await waitFor(() => expect(alerta()).toHaveTextContent(t("account.delete.lastAdmin")));
    expect(alerta()).not.toHaveTextContent(t("account.delete.failed"));
    expect(t("account.delete.lastAdmin")).toMatch(/único administrador/);
    expect(t("account.delete.lastAdmin")).toMatch(/invita|nombra|transfiere/i);
    expect(t("account.delete.lastAdmin")).toMatch(/todavía no|aún no/i);
    expect(goTo).not.toHaveBeenCalled();
    expect(confirmar()).toBeEnabled();
  });
  it("un 409 con otro código sigue mostrando el mensaje genérico", async () => {
    stubFetch(() => jsonRes(409, { error: "otra_cosa" }));
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    fireEvent.click(confirmar());
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(t("account.delete.failed")));
  });
  it("F10: fallo de red -> mensaje genérico y sin navegar", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    render(<DeleteAccount />);
    abrir();
    escribirClave("una-clave-larga");
    fireEvent.click(confirmar());
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(t("account.delete.failed")));
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
