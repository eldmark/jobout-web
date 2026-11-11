/** Página /demo: los GIF de la presentación del MVP, accesibles y sin cargar todo de golpe. */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import Demo from "@/app/demo/page";
import { CLIPS } from "@/lib/demo/clips";

describe("/demo", () => {
  it("tiene un h1 y un enlace para volver al inicio", () => {
    render(<Demo />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Así funciona JobOut");
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
  });

  it("muestra cada clip con título, descripción e imagen con texto alternativo", () => {
    render(<Demo />);
    expect(CLIPS.length).toBeGreaterThanOrEqual(4);
    for (const c of CLIPS) {
      const fig = screen.getByRole("figure", { name: c.title });
      const img = within(fig).getByRole("img");
      expect(img).toHaveAttribute("src", `/demo/${c.file}`);
      expect(img.getAttribute("alt") ?? "").toMatch(/\S{3,}/);
      expect(within(fig).getByText(c.description)).toBeInTheDocument();
    }
  });

  it("las imágenes cargan perezosas y con tamaño fijo (sin saltos de diseño)", () => {
    render(<Demo />);
    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
      expect(Number(img.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(img.getAttribute("height"))).toBeGreaterThan(0);
    }
  });

  it("cada GIF existe en public/demo", () => {
    for (const c of CLIPS) {
      expect(existsSync(join(process.cwd(), "public", "demo", c.file)), c.file).toBe(true);
    }
  });

  it("los títulos son únicos", () => {
    expect(new Set(CLIPS.map((c) => c.title)).size).toBe(CLIPS.length);
  });
});
