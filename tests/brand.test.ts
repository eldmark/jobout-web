/** F12: tokens de marca una sola vez, sin hex sueltos, texto sobre coral en tinta. */
import { describe, it, expect } from "vitest";
import { leer, listar } from "./helpers/fuentes";

const TOKENS: Record<string, string> = {
  "--color-indigo": "#5b4bff",
  "--color-ink": "#14122b",
  "--color-coral": "#ff6b4a",
  "--color-mint": "#2fd39a",
  "--color-lavender": "#ece9ff",
};

const css = leer("app/globals.css");

describe("F12 tokens de marca", () => {
  for (const [nombre, hex] of Object.entries(TOKENS)) {
    it(`${nombre} se declara una sola vez con ${hex}`, () => {
      const decl = css.match(new RegExp(`${nombre}\\s*:\\s*([^;]+);`, "g")) ?? [];
      expect(decl).toHaveLength(1);
      expect(decl[0]!.toLowerCase()).toContain(hex);
      // y el hex no aparece en ningún otro sitio del CSS
      expect(css.toLowerCase().split(hex).length - 1).toBe(1);
    });
  }

  it("ningún componente ni layout escribe un hex a mano", () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    for (const f of listar("app", /\.(tsx?|jsx?)$/)) {
      expect(leer(f), `hex suelto en ${f}`).not.toMatch(hex);
    }
  });

  it("el texto sobre coral usa tinta, nunca blanco", () => {
    // Cada regla CSS que pinta fondo coral debe fijar color: var(--color-ink).
    const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const conCoral = reglas.filter(([, , cuerpo]) =>
      /background(-color)?\s*:\s*var\(--color-coral\)/.test(cuerpo),
    );
    expect(conCoral.length).toBeGreaterThan(0);
    for (const [, sel, cuerpo] of conCoral) {
      expect(cuerpo, `regla ${sel.trim()}`).toMatch(/(^|[;\s])color\s*:\s*var\(--color-ink\)/);
      expect(cuerpo).not.toMatch(/(^|[;\s])color\s*:\s*(#fff|white|var\(--color-white\))/i);
    }
  });
});

describe("fuentes de marca", () => {
  const layout = leer("app/layout.tsx");
  it("carga Sora y Manrope con next/font/google y expone variables CSS", () => {
    expect(layout).toMatch(/from\s+"next\/font\/google"/);
    expect(layout).toMatch(/\bSora\b/);
    expect(layout).toMatch(/\bManrope\b/);
    expect(layout).toMatch(/variable:\s*"--font-sora"/);
    expect(layout).toMatch(/variable:\s*"--font-manrope"/);
  });
  it("el CSS usa las variables de fuente", () => {
    expect(css).toMatch(/var\(--font-manrope\)/);
    expect(css).toMatch(/var\(--font-sora\)/);
  });
});

describe("etiqueta del CV primario y selector de archivo", () => {
  const regla = (sel: string) =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, s]) => s.trim().split(/\s*,\s*/).includes(sel));

  it("la etiqueta dentro de una tarjeta no se estira a todo el ancho", () => {
    const cuerpos = regla(".tarjeta .etiqueta").map(([, , c]) => c).join(";");
    expect(cuerpos).toMatch(/justify-self\s*:\s*start|width\s*:\s*fit-content/);
    expect(cuerpos).not.toMatch(/width\s*:\s*100%/);
  });
  it("el input de archivo se oculta visualmente sin display:none", () => {
    const cuerpos = regla(".campo .archivo__input").map(([, , c]) => c).join(";");
    expect(cuerpos).toMatch(/position\s*:\s*absolute/);
    expect(cuerpos).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden/);
  });
  it("el foco del input se ve en el control", () => {
    expect(css).toMatch(/\.archivo:focus-within/);
  });
});
