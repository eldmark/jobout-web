/** FC7: los textos de ofertas y aplicaciones salen de lib/messages (tuteo), sin claves crudas ni huérfanas, y sin HTML crudo. */
import { describe, it, expect } from "vitest";
import { es } from "@/lib/messages/es";
import { leer, listar } from "./helpers/fuentes";

const PREFIJOS = /^(offers?|apply|applications|external|dashboard\.nav)\./;
const claves = Object.keys(es).filter((k) => PREFIJOS.test(k));
const fuentes = [...listar("app", /\.tsx?$/), ...listar("lib", /\.ts$/)].filter((f) => !f.startsWith("lib/messages"));
const codigo = fuentes.map((f) => leer(f)).join("\n");
const COMPONENTES = ["app/_components/OffersList.tsx", "app/_components/OfferDetail.tsx", "app/_components/ApplyDialog.tsx", "app/_components/ApplicationsView.tsx", "app/_components/ExternalApplications.tsx"];

describe("FC7 mensajes de ofertas y aplicaciones", () => {
  it("existen", () => {
    expect(claves.length).toBeGreaterThan(100);
  });
  it("están en tuteo: sin voseo ni «usted»", () => {
    const voseo = /\b(tenés|querés|podés|sabés|elegí|escribí|aplicá|retirá|filtrá|mirá|usá|revisá|esperá|volvé|anotá|borrá|guardá|vos|usted|ustedes)\b/i;
    for (const k of claves) expect(es[k as keyof typeof es], k).not.toMatch(voseo);
  });
  it("cada clave usada en el código existe (nada de claves crudas)", () => {
    const usadas = new Set([...codigo.matchAll(/["'`]((?:offers?|apply|applications|external|dashboard\.nav)\.[A-Za-z_.]+)["'`]/g)].map((m) => m[1]).filter((k) => !k.endsWith(".")));
    expect(usadas.size).toBeGreaterThan(50);
    for (const k of usadas) expect(es, k).toHaveProperty([k]);
  });
  it("no hay mensajes huérfanos: cada clave se usa (literal o armada por prefijo)", () => {
    const prefijosDinamicos = [...codigo.matchAll(/`((?:offers?|apply|applications|external)\.[A-Za-z_.]+\.)\$\{/g)].map((m) => m[1]);
    const huerfanas = claves.filter((k) => !codigo.includes(`"${k}"`) && !prefijosDinamicos.some((p) => k.startsWith(p)));
    expect(huerfanas).toEqual([]);
  });
  it("los componentes nuevos existen, no escriben hex a mano y nunca pintan HTML crudo (SX7, OF10)", () => {
    for (const f of COMPONENTES) {
      const src = leer(f);
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
    for (const f of listar("app", /\.tsx?$/)) expect(leer(f), f).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
