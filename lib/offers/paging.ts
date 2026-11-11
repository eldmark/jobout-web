/**
 * Listado paginado por cursor con «Cargar más»: lo comparten ofertas, mis aplicaciones y las externas.
 * Es el mismo comportamiento que la lista de entrevistas (`InterviewSessions`), sacado a un hook para
 * no repetirlo tres veces.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Result } from "./client";
import type { Page } from "./types";

/** Añade al final sin repetir los ids que ya estaban (el backend puede repetir uno entre páginas). */
export function appendUnique<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const vistos = new Set(prev.map((x) => x.id));
  return [...prev, ...next.filter((x) => !vistos.has(x.id))];
}

export interface CursorList<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  /** «loading» también tras un 401: el cliente ya está llevando a /sign-in. */
  phase: "loading" | "error" | "ready";
  hasMore: boolean;
  loadingMore: boolean;
  moreError: boolean;
  reload: () => Promise<void>;
  more: () => Promise<void>;
  /** Índice del primer elemento recién añadido, para mover el foco ahí; el componente lo consume. */
  firstNew: MutableRefObject<number | null>;
  /** La primera página tal como llegó (con `sorted_by`, `match_unavailable`...); null mientras carga. */
  head: Page<T> | null;
}

/** `fetchPage` cambia cuando cambia la consulta (p. ej. los filtros): entonces se recarga desde cero. */
export function useCursorList<T extends { id: string }>(fetchPage: (cursor?: string) => Promise<Result<Page<T>>>): CursorList<T> {
  const [items, setItems] = useState([] as T[]);
  const [cursor, setCursor] = useState(null as string | null);
  const [phase, setPhase] = useState("loading" as CursorList<T>["phase"]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [head, setHead] = useState(null as Page<T> | null);
  const enVuelo = useRef(false);
  const firstNew = useRef(null as number | null);
  // Cada recarga es una «generación»: la respuesta de una consulta vieja que llega tarde se descarta.
  const generacion = useRef(0);

  const reload = useCallback(async () => {
    const gen = ++generacion.current;
    setPhase("loading");
    setMoreError(false);
    const r = await fetchPage(undefined);
    if (gen !== generacion.current) return;
    if (r.data) {
      setHead(r.data);
      setItems(r.data.items);
      setCursor(r.data.next_cursor ?? null);
      setPhase("ready");
    } else if (r.status !== 401) {
      setPhase("error");
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const more = useCallback(async () => {
    if (enVuelo.current || !cursor) return;
    enVuelo.current = true;
    const gen = generacion.current;
    setLoadingMore(true);
    setMoreError(false);
    const r = await fetchPage(cursor);
    enVuelo.current = false;
    setLoadingMore(false);
    if (gen !== generacion.current) return;
    // 422 con cursor: el cursor es de otro orden (p. ej. el de `sort=match` en otro listado). No se
    // puede continuar; se vuelve a la primera página en vez de dejar un error sin salida.
    if (r.status === 422) {
      await reload();
      return;
    }
    if (r.data) {
      const nuevos = r.data.items;
      setItems((prev) => {
        firstNew.current = prev.length;
        return appendUnique(prev, nuevos);
      });
      setCursor(r.data.next_cursor ?? null);
    } else if (r.status !== 401) {
      setMoreError(true);
    }
  }, [cursor, fetchPage, reload]);

  return { items, setItems, phase, hasMore: cursor !== null, loadingMore, moreError, reload, more, firstNew, head };
}
