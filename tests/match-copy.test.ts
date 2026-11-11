/** Textos del matching: en lib/messages, tuteo, sin claves crudas ni huérfanas, y sin color a mano. */
import { describe, it, expect } from "vitest";
import { es } from "@/lib/messages/es";
import { leer, listar } from "./helpers/fuentes";

const claves = Object.keys(es).filter((k) => /^(match\.|offers\.match\.|apply\.(field|hint)\.match_score)/.test(k));
const fuentes = [...listar("app", /\.tsx?$/), ...listar("lib", /\.ts$/)].filter((f) => !f.startsWith("lib/messages"));
const codigo = fuentes.map((f) => leer(f)).join("\n");

describe("copy del matching", () => {
  it("existen", () => expect(claves.length).toBeGreaterThan(25));
  it("tuteo: sin voseo ni «usted»", () => {
    const voseo = /\b(tenés|querés|podés|completá|mirá|vos|usted|ustedes)\b/i;
    for (const k of claves) expect(es[k as keyof typeof es], k).not.toMatch(voseo);
  });
  it("cada clave `match.` usada en el código existe", () => {
    const usadas = new Set([...codigo.matchAll(/["'`]((?:match|offers\.match)\.[A-Za-z_.]+)["'`]/g)].map((m) => m[1]).filter((k) => !k.endsWith(".")));
    expect(usadas.size).toBeGreaterThan(15);
    for (const k of usadas) expect(es, k).toHaveProperty([k]);
  });
  it("ninguna clave queda huérfana (literal o armada por prefijo)", () => {
    const dinamicos = [...codigo.matchAll(/`((?:match|offers\.match|apply\.hint)\.[A-Za-z_.]+\.)\$\{/g)].map((m) => m[1]);
    const huerfanas = claves.filter((k) => !codigo.includes(`"${k}"`) && !dinamicos.some((p) => k.startsWith(p)) && k !== "apply.field.match_score");
    expect(huerfanas).toEqual([]);
  });
  it("los textos de la especificación, tal cual", () => {
    expect(es["offers.filters.sort.match"]).toBe("Mejor afinidad");
    expect(es["match.title.candidate"]).toBe("Afinidad con tu perfil");
    expect(es["apply.field.match_score"]).toBe("Compartir mi afinidad con esta oferta");
    expect(es["match.reason.no_compartido"]).toBe("La persona no compartió este dato.");
  });
  it("el componente y el CSS no escriben hex a mano", () => {
    expect(leer("app/_components/MatchBreakdown.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
