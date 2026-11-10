/** Rediseño de registro e ingreso (jb-55): el panel de marca no cambia el formulario (V10). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SignUpPage from "@/app/sign-up/page";
import SignInPage from "@/app/sign-in/page";
import { t, type MessageKey } from "@/lib/messages";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));
afterEach(cleanup);

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
