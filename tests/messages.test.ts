/** F11: ningún texto visible literal en app/ ; todo sale de lib/messages. */
import { describe, it, expect } from "vitest";
import { t } from "@/lib/messages";
import { es } from "@/lib/messages/es";
import { leer, listar } from "./helpers/fuentes";

describe("t(clave)", () => {
  it("devuelve el texto en español", () => {
    expect(t("brand.name")).toBe("JobOut");
    expect(t("brand.slogan")).toBe("Llega listo a tu primera entrevista.");
  });
  it("lanza con claves inexistentes en vez de mostrar la clave cruda", () => {
    // @ts-expect-error clave inválida a propósito
    expect(() => t("no.existe")).toThrow(/no.existe/);
  });
  it("los mensajes están en tuteo (sin voseo)", () => {
    const voseo = /\b(Preparate|practicá|llegá|tenés|podés|hacé|Empezá|Ingresá)\b/i;
    for (const v of Object.values(es)) expect(v).not.toMatch(voseo);
  });
});

/**
 * Límites: es un chequeo por regex, no un parser. Detecta (a) texto entre
 * etiquetas JSX, (b) atributos de texto visible con string literal
 * (alt, title, aria-label, placeholder, label) y (c) title/description
 * literales en `metadata`. No detecta texto armado con concatenaciones,
 * template strings fuera de JSX ni strings en variables que luego se pintan.
 */
function textoLiteral(src: string): string[] {
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hallazgos: string[] = [];
  for (const m of sinComentarios.matchAll(/>([^<>{}]*)</g)) {
    const txt = m[1].trim();
    if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(txt)) hallazgos.push(txt);
  }
  for (const m of sinComentarios.matchAll(/\b(alt|title|aria-label|placeholder|label)\s*=\s*"([^"]+)"/g)) {
    hallazgos.push(m[2]);
  }
  for (const m of sinComentarios.matchAll(/\b(title|description)\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    hallazgos.push(m[2]);
  }
  return hallazgos;
}

describe("F11 sin texto visible literal en app/", () => {
  const archivos = listar("app", /\.tsx$/);
  it("hay componentes que revisar", () => expect(archivos.length).toBeGreaterThan(1));
  for (const f of archivos) {
    it(`${f}`, () => expect(textoLiteral(leer(f))).toEqual([]));
  }
  it("el detector sí atrapa texto literal (prueba del propio chequeo)", () => {
    expect(textoLiteral(`<p>Hola mundo</p>`)).toEqual(["Hola mundo"]);
    expect(textoLiteral(`<img alt="logo" />`)).toEqual(["logo"]);
    expect(textoLiteral(`<p>{t("brand.name")}</p>`)).toEqual([]);
  });
});
