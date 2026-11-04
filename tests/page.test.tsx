import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";
import { leer } from "./helpers/fuentes";

describe("Home", () => {
  it("muestra el nombre del producto", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("JobOut");
  });

  // Hallazgo de la revisión en el navegador: la home no llevaba a ningún lado.
  it("lleva al registro y al ingreso", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("ya no muestra el texto de andamio", () => {
    render(<Home />);
    expect(document.body.textContent ?? "").not.toMatch(/andamio/i);
  });
});

describe("Diálogo de borrado (modo oscuro)", () => {
  const css = leer("app/globals.css");
  const bloque = (selector: string) => {
    const m = css.match(new RegExp(`(^|\\n)${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`));
    return m?.[2] ?? "";
  };

  // Hallazgo: en oscuro el panel tenía el mismo color que la página y no se distinguía.
  it("tiene borde y usa una superficie propia, no el fondo de la página", () => {
    const dialogo = bloque(".dialogo");
    expect(dialogo).toMatch(/border\s*:/);
    expect(dialogo).toMatch(/background\s*:\s*var\(--superficie\)/);
  });

  it("en oscuro la superficie es distinta del fondo", () => {
    const oscuro = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(oscuro).toMatch(/--superficie\s*:/);
    expect(oscuro).not.toMatch(/--superficie\s*:\s*var\(--fondo\)/);
  });
});
