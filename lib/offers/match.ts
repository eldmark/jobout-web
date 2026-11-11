/** Matching (5b): ayudas para pintar `match`. El backend calcula; aquí solo se valida la forma y se formatea. */
import { MATCH_KEYS, type Match } from "./types";

const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * `true` si `x` tiene la forma del contrato: puntaje entero 0–100 y los cuatro componentes en orden.
 * Una respuesta que no la cumple no se pinta (mejor nada que un puntaje inventado).
 */
export function isMatch(x: unknown): x is Match {
  if (typeof x !== "object" || x === null) return false;
  const m = x as { score?: unknown; breakdown?: { components?: unknown } | null };
  if (!esNumero(m.score) || !Number.isInteger(m.score) || m.score < 0 || m.score > 100) return false;
  const comps = m.breakdown?.components;
  if (!Array.isArray(comps) || comps.length !== MATCH_KEYS.length) return false;
  return comps.every((c, i) => typeof c === "object" && c !== null && (c as { key?: unknown }).key === MATCH_KEYS[i] && esNumero((c as { weight?: unknown }).weight) && esNumero((c as { points?: unknown }).points));
}

/** Puntos o años con a lo sumo un decimal y coma decimal: `33,3`, `15`. */
export function formatPoints(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}
