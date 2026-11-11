/**
 * El orden y los filtros de /offers viajan en la URL (`?sort=match&profession_id=…`) para poder
 * compartirlos y sobrevivir a recargar o a «atrás». Solo eso: el cursor de paginación NUNCA va en la URL
 * (es opaco y de un solo orden) y todo lo que no sea del contrato se descarta al leer.
 */
import { OFFER_FILTERS, OFFER_SORTS, type OfferFilter, type OfferSort } from "./types";

export interface ConsultaOfertas {
  sort: OfferSort;
  filtros: Partial<Record<OfferFilter, string>>;
}

export const CONSULTA_INICIAL: ConsultaOfertas = { sort: "recent", filtros: {} };

type Fuente = URLSearchParams | Record<string, string | string[] | undefined>;

/** Ids de catálogo: uuid u otro identificador corto; nada con espacios, signos ni marcado. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function primero(f: Fuente, k: string): string | undefined {
  if (f instanceof URLSearchParams) return f.get(k) ?? undefined;
  const v = f[k];
  return Array.isArray(v) ? v[0] : v;
}

export function consultaDeUrl(f: Fuente): ConsultaOfertas {
  const orden = primero(f, "sort");
  const sort = OFFER_SORTS.find((s) => s === orden) ?? "recent";
  const filtros: ConsultaOfertas["filtros"] = {};
  for (const campo of OFFER_FILTERS) {
    const v = primero(f, campo);
    if (v && ID.test(v)) filtros[campo] = v;
  }
  // El municipio se pide por departamento: sin departamento no tiene sentido.
  if (!filtros.state_id) delete filtros.city_id;
  return { sort, filtros };
}

/** `?a=b` o cadena vacía. Solo lo que se aparta del valor por defecto. */
export function consultaAUrl(c: ConsultaOfertas): string {
  const q = new URLSearchParams();
  if (c.sort !== "recent") q.set("sort", c.sort);
  for (const campo of OFFER_FILTERS) {
    const v = c.filtros[campo];
    if (v) q.set(campo, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
