/** Matching (5b, paso 8): tipos y contrato en el cliente. `api.md`, «Matching (Fase 5b)». */
import { describe, it, expect } from "vitest";
import { MATCH } from "./helpers/offers";
import { consentBody, fieldAvailability } from "@/lib/offers/consent";
import { formatPoints, isMatch } from "@/lib/offers/match";
import { offerQuery } from "@/lib/offers/client";
import { MANDATORY_FIELDS, OFFER_SORTS, SHARED_FIELDS } from "@/lib/offers/types";

describe("contrato: match_score y sort=match", () => {
  it("match_score es el décimo campo compartible y no es obligatorio", () => {
    expect(SHARED_FIELDS).toHaveLength(10);
    expect(SHARED_FIELDS[9]).toBe("match_score");
    expect(MANDATORY_FIELDS).not.toContain("match_score");
  });
  it("sin marcarlo, shared_fields no lo lleva; marcado, va al final en el orden del contrato", () => {
    expect(consentBody([], true)?.shared_fields).not.toContain("match_score");
    expect(consentBody(["match_score", "phone"], true)?.shared_fields).toEqual(["display_name", "skills", "experience", "phone", "match_score"]);
  });
  it("la disponibilidad de match_score no depende del perfil", () => {
    expect(fieldAvailability(null).match_score).toBeNull();
  });
  it("el orden por afinidad existe y viaja como sort=match", () => {
    expect(OFFER_SORTS).toEqual(["recent", "oldest", "match"]);
    expect(offerQuery({ sort: "match" })).toBe("?sort=match");
  });
});

describe("isMatch: solo acepta la forma del contrato", () => {
  it("acepta un match completo", () => expect(isMatch(MATCH())).toBe(true));
  it("rechaza lo que no es: undefined, null, sin puntaje, puntaje fuera de 0–100 o sin componentes", () => {
    for (const x of [undefined, null, 5, {}, { score: "67", breakdown: MATCH().breakdown }, { score: 101, breakdown: MATCH().breakdown }, { score: -1, breakdown: MATCH().breakdown }, { score: 50 }, { score: 50, breakdown: { components: "x" } }]) {
      expect(isMatch(x), JSON.stringify(x)).toBe(false);
    }
  });
});

describe("formatPoints", () => {
  it("coma decimal y sin ceros de más", () => {
    expect(formatPoints(33.3)).toBe("33,3");
    expect(formatPoints(15)).toBe("15");
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(10.0)).toBe("10");
  });
});
