/** F15: textos solo desde lib/messages (tuteo), colores de marca una vez, texto sobre coral en tinta. */
import { describe, it, expect } from "vitest";
import { es } from "@/lib/messages/es";
import { leer, listar } from "./helpers/fuentes";

const PREFIJOS = /^(interview\.|progress\.|dashboard\.(practice|resume))/;
const claves = Object.keys(es).filter((k) => PREFIJOS.test(k));
const fuentes = [...listar("app", /\.tsx?$/), ...listar("lib", /\.ts$/)].filter((f) => !f.startsWith("lib/messages"));
const codigo = fuentes.map((f) => leer(f)).join("\n");

describe("F15 mensajes de entrevistas", () => {
  it("hay mensajes de entrevistas, progreso y dashboard", () => {
    expect(claves.length).toBeGreaterThan(80);
  });
  it("están en tuteo: sin voseo", () => {
    const voseo = /\b(tenés|querés|podés|sabés|elegí|escribí|empezá|retomá|practicá|abandoná|pausá|borrá|terminá|respondé|reintentá|volvé|hacé|mirá|usá|revisá|esperá|recargá|inténtalo vos|vos)\b/i;
    for (const k of claves) expect(es[k as keyof typeof es], k).not.toMatch(voseo);
  });
  it("hablan de tú: usan «tu/tus/tienes/puedes…» y nunca «usted»", () => {
    const todo = claves.map((k) => es[k as keyof typeof es]).join(" ");
    expect(todo).toMatch(/\b(tu|tus|tienes|puedes|necesitas|elige)\b/i);
    expect(todo).not.toMatch(/\b(usted|ustedes)\b/i);
  });
  it("el aviso de la IA dice quién recibe las respuestas y pide no escribir datos sensibles (JB-92)", () => {
    const aviso = es["interview.start.ai.notice"];
    expect(aviso).toMatch(/modelo de IA/);
    expect(aviso).toMatch(/OpenRouter/);
    expect(aviso).toMatch(/guardarlas|entrenarse/);
    expect(aviso).toMatch(/No escribas datos personales sensibles/);
    expect(es["interview.start.ai.ack"]).toMatch(/Entiendo/);
    expect(es["interview.start.validation.ai"]).toMatch(/aviso/i);
  });
  it("cada clave usada en el código existe (nada de claves crudas)", () => {
    const usadas = new Set([...codigo.matchAll(/["'`]((?:interview|progress)\.[A-Za-z.]+|dashboard\.(?:practice|resume))["'`]/g)].map((m) => m[1]));
    expect(usadas.size).toBeGreaterThan(50);
    for (const k of usadas) expect(es, k).toHaveProperty([k]);
  });
  it("no hay mensajes huérfanos: cada clave se usa en algún componente", () => {
    const huerfanas = claves.filter((k) => !codigo.includes(`"${k}"`));
    expect(huerfanas).toEqual([]);
  });
  it("los componentes de entrevista existen y no escriben hex a mano", () => {
    const nuevos = fuentes.filter((f) => /Interview|Progress/.test(f));
    expect(nuevos.length).toBeGreaterThanOrEqual(3);
    for (const f of nuevos) expect(leer(f), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("el botón coral pinta su texto en tinta y las clases nuevas no usan hex", () => {
    const css = leer("app/globals.css");
    const regla = css.match(/\.boton--coral\s*\{([^}]*)\}/)![1];
    expect(regla).toMatch(/color\s*:\s*var\(--color-ink\)/);
    const bloque = css.slice(css.indexOf("/* --- Entrevista --- */"));
    expect(bloque.length).toBeGreaterThan(200);
    expect(bloque).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
