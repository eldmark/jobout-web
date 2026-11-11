/** useCursorList: primera página, «Cargar más» por cursor, errores y recarga (lo comparten los tres listados). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { appendUnique, useCursorList } from "@/lib/offers/paging";
import type { Result } from "@/lib/offers/client";
import type { Page } from "@/lib/offers/types";

afterEach(cleanup);

type Item = { id: string };
const ok = (ids: string[], next: string | null = null): Result<Page<Item>> => ({ status: 200, data: { items: ids.map((id) => ({ id })), next_cursor: next }, error: null, applicationId: null, currentStatus: null, retryAfter: null, fields: null });
const falla = (status: number): Result<Page<Item>> => ({ status, data: null, error: null, applicationId: null, currentStatus: null, retryAfter: null, fields: null });
const ids = (xs: Item[]) => xs.map((x) => x.id);

describe("appendUnique", () => {
  it("añade al final sin repetir ids que ya estaban", () => {
    expect(ids(appendUnique([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]))).toEqual(["a", "b", "c"]);
  });
});

describe("useCursorList", () => {
  it("pide la primera página sin cursor y queda lista con sus elementos", async () => {
    const pagina = vi.fn(async (_c?: string) => ok(["a", "b"], "c1"));
    const { result } = renderHook(() => useCursorList(pagina));
    expect(result.current.phase).toBe("loading");
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(ids(result.current.items)).toEqual(["a", "b"]);
    expect(result.current.hasMore).toBe(true);
    expect(pagina).toHaveBeenCalledWith(undefined);
  });
  it("más: pide con el cursor, añade sin repetir y marca dónde empiezan los nuevos; sin cursor, ya no hay más", async () => {
    const pagina = vi.fn(async (c?: string) => (c ? ok(["b", "c"]) : ok(["a", "b"], "c1")));
    const { result } = renderHook(() => useCursorList(pagina));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(() => result.current.more());
    expect(pagina).toHaveBeenLastCalledWith("c1");
    expect(ids(result.current.items)).toEqual(["a", "b", "c"]);
    expect(result.current.firstNew.current).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });
  it("dos «más» seguidos hacen una sola petición", async () => {
    let soltar: (r: Result<Page<Item>>) => void = () => {};
    const pagina = vi.fn((c?: string) => (c ? new Promise<Result<Page<Item>>>((r) => (soltar = r)) : Promise.resolve(ok(["a"], "c1"))));
    const { result } = renderHook(() => useCursorList(pagina));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    let p1: Promise<void> = Promise.resolve();
    act(() => {
      p1 = result.current.more();
      void result.current.more();
    });
    expect(result.current.loadingMore).toBe(true);
    await act(async () => {
      soltar(ok(["b"]));
      await p1;
    });
    expect(pagina).toHaveBeenCalledTimes(2);
    expect(result.current.loadingMore).toBe(false);
  });
  it("si falla la primera página: error; recargar la vuelve a pedir", async () => {
    let n = 0;
    const pagina = vi.fn(async () => (n++ === 0 ? falla(502) : ok(["a"])));
    const { result } = renderHook(() => useCursorList(pagina));
    await waitFor(() => expect(result.current.phase).toBe("error"));
    await act(() => result.current.reload());
    expect(result.current.phase).toBe("ready");
  });
  it("si falla «más»: conserva lo que había y lo avisa", async () => {
    const pagina = vi.fn(async (c?: string) => (c ? falla(503) : ok(["a"], "c1")));
    const { result } = renderHook(() => useCursorList(pagina));
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    await act(() => result.current.more());
    expect(result.current.moreError).toBe(true);
    expect(ids(result.current.items)).toEqual(["a"]);
    expect(result.current.hasMore).toBe(true);
  });
  it("un 401 no se muestra como error (el cliente ya lleva a /sign-in)", async () => {
    const pagina = vi.fn(async () => falla(401));
    const { result } = renderHook(() => useCursorList(pagina));
    await waitFor(() => expect(pagina).toHaveBeenCalled());
    expect(result.current.phase).toBe("loading");
  });
  it("si cambia la consulta, recarga desde cero y descarta la respuesta vieja que llegue tarde", async () => {
    const soltar: Record<string, (r: Result<Page<Item>>) => void> = {};
    const hacer = (q: string) => () => new Promise<Result<Page<Item>>>((r) => (soltar[q] = r));
    const { result, rerender } = renderHook(({ f }) => useCursorList(f), { initialProps: { f: hacer("vieja") } });
    rerender({ f: hacer("nueva") });
    await act(async () => soltar.nueva(ok(["n"])));
    await act(async () => soltar.vieja(ok(["v"])));
    expect(ids(result.current.items)).toEqual(["n"]);
  });
});
