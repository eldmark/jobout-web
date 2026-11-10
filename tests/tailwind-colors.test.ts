/** V8: con Tailwind, los componentes solo usan los colores de la marca y el coral lleva tinta. */
import { describe, it, expect } from "vitest";
import { leer, listar } from "./helpers/fuentes";

/** Clases de la paleta por defecto de Tailwind (que este proyecto borra con `--color-*: initial`). */
const PALETA_POR_DEFECTO =
  /\b(?:bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|divide|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|violet|purple|fuchsia|pink|rose|black|indigo-\d{2,3})\b/;
/** Cada string literal que pinta fondo coral. */
const LITERALES_CON_CORAL = /(["'`])(?:(?!\1)[^\\]|\\.)*?\bbg-coral\b(?:(?!\1)[^\\]|\\.)*?\1/g;

const fuentes = listar("app", /\.tsx$/);

describe("V8 colores de Tailwind", () => {
  it("ningún componente usa la paleta por defecto de Tailwind", () => {
    for (const f of fuentes) expect(leer(f), f).not.toMatch(PALETA_POR_DEFECTO);
  });

  it("todo fondo coral lleva texto en tinta en la misma lista de clases", () => {
    for (const f of fuentes) {
      for (const [literal] of leer(f).matchAll(LITERALES_CON_CORAL)) {
        expect(literal, f).toMatch(/\btext-ink\b/);
      }
    }
  });

  it("el detector sí atrapa lo que debe (prueba del propio chequeo)", () => {
    expect('className="bg-zinc-950 p-4"').toMatch(PALETA_POR_DEFECTO);
    expect('className="text-indigo-500"').toMatch(PALETA_POR_DEFECTO);
    expect('className="text-indigo bg-lavender"').not.toMatch(PALETA_POR_DEFECTO);
    expect([...'cn("bg-coral text-white")'.matchAll(LITERALES_CON_CORAL)]).toHaveLength(1);
  });
});
