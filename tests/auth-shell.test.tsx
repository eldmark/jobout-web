/** Rediseño de registro e ingreso (jb-55): el panel de marca no cambia el formulario (V10). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SignUpPage from "@/app/sign-up/page";
import SignInPage from "@/app/sign-in/page";
import { t, type MessageKey } from "@/lib/messages";
import { leer } from "./helpers/fuentes";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(cleanup);

// Revisión de Lázaro: con nombre y apellido lado a lado, los campos se salían de la tarjeta. Un
// <input> tiene ancho mínimo propio (unos 200 px) y una columna `1fr` no baja de ese mínimo, así
// que la grilla quedaba más ancha que la tarjeta. jsdom no calcula layout: se fija la regla CSS.
describe("los campos del registro no se salen de la tarjeta", () => {
  const css = leer("app/globals.css");

  it("las dos columnas usan minmax(0, 1fr): un campo no puede ensanchar la grilla", () => {
    expect(css).toMatch(/\.auth-form \.formulario\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  });

  it("los campos llenan su columna y no tienen ancho mínimo propio", () => {
    const regla = css.match(/\.auth-form \.campo input\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(regla).toMatch(/(^|[;\s])width:\s*100%/);
    expect(regla).toMatch(/min-width:\s*0/);
  });
});

describe.each([
  ["/sign-up", SignUpPage, "auth.signUp.title"],
  ["/sign-in", SignInPage, "auth.signIn.title"],
] as const)("%s con panel de marca", (_ruta, Pagina, titulo) => {
  it("V10: sigue teniendo un solo h1, el del formulario", () => {
    render(<Pagina />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(t(titulo as MessageKey));
  });

  it("el logo lleva al inicio", () => {
    render(<Pagina />);
    expect(screen.getAllByRole("link", { name: t("home.nav.homeLabel") })[0]).toHaveAttribute("href", "/");
  });

  it("V3: el fondo animado del panel es decorativo", () => {
    const { container } = render(<Pagina />);
    const lienzos = container.querySelectorAll("canvas");
    expect(lienzos.length).toBeGreaterThan(0);
    for (const c of lienzos) expect(c.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("el panel cuenta qué ofrece JobOut, con textos de mensajes", () => {
    render(<Pagina />);
    for (const k of ["auth.panel.point1", "auth.panel.point2", "auth.panel.point3"] as MessageKey[]) {
      expect(screen.getByText(t(k))).toBeInTheDocument();
    }
  });
});
