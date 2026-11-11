/**
 * FC7 y «Reglas» del lado empresa: textos en lib/messages (tuteo), sin claves crudas ni huérfanas; los
 * componentes nunca pintan HTML crudo, ni guardan datos en el navegador, ni los mandan a la consola.
 */
import { describe, it, expect } from "vitest";
import { es } from "@/lib/messages/es";
import { leer, listar } from "./helpers/fuentes";

const PREFIJOS = /^(company|companyForm|companyOffers|offerForm|panel|admin)\./;
const claves = Object.keys(es).filter((k) => PREFIJOS.test(k));
const fuentes = [...listar("app", /\.tsx?$/), ...listar("lib", /\.ts$/)].filter((f) => !f.startsWith("lib/messages"));
const codigo = fuentes.map((f) => leer(f)).join("\n");
const COMPONENTES = ["CompanyView", "CompanyOffers", "OfferEditor", "RecruiterPanel", "AdminCompanies"].map((c) => `app/_components/${c}.tsx`);

describe("FC7 mensajes del lado empresa", () => {
  it("existen", () => expect(claves.length).toBeGreaterThan(120));
  it("están en tuteo: sin voseo ni «usted»", () => {
    const voseo = /\b(tenés|querés|podés|sabés|elegí|escribí|publicá|pausá|cerrá|borrá|guardá|invitá|copiá|verificá|revisá|esperá|volvé|vos|usted|ustedes)\b/i;
    for (const k of claves) expect(es[k as keyof typeof es], k).not.toMatch(voseo);
  });
  it("cada clave usada en el código existe", () => {
    const usadas = new Set([...codigo.matchAll(/["'`]((?:company|companyForm|companyOffers|offerForm|panel|admin)\.[A-Za-z_.]+)["'`]/g)].map((m) => m[1]).filter((k) => !k.endsWith(".")));
    expect(usadas.size).toBeGreaterThan(80);
    for (const k of usadas) expect(es, k).toHaveProperty([k]);
  });
  it("no hay mensajes huérfanos (literales o armados por prefijo)", () => {
    const dinamicos = [...codigo.matchAll(/`((?:company|companyForm|companyOffers|offerForm|panel|admin)\.[A-Za-z_.]+\.)\$\{/g)].map((m) => m[1]);
    const huerfanas = claves.filter((k) => !codigo.includes(`"${k}"`) && !dinamicos.some((p) => k.startsWith(p)));
    expect(huerfanas).toEqual([]);
  });
});

describe("BUG-009: el 403 sin permiso no supone que la persona tiene empresa", () => {
  // `sin_permiso` llega igual a un candidato sin empresa que abre una página de empresa y a un
  // reclutador sin el permiso de administrador: el texto tiene que ser cierto para los dos.
  const m = es["company.error.noPermission"];
  it("no habla del «rol en la empresa»", () => expect(m).not.toMatch(/rol en la empresa|tu empresa/i));
  it("dice que falta el permiso y qué hacer", () => {
    expect(m).toMatch(/permiso/i);
    expect(m).toMatch(/administra/i);
  });
});

describe("«Reglas» en el código de las pantallas de empresa (SX7, OF10)", () => {
  for (const f of COMPONENTES) {
    it(`${f}: sin HTML crudo, sin almacenamiento del navegador, sin console.log, sin hex a mano`, () => {
      const src = leer(f);
      expect(src).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
      expect(src).not.toMatch(/console\.(log|info|debug)/);
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  }
});
