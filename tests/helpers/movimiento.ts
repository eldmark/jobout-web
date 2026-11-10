/** Dobles de `matchMedia` e `IntersectionObserver` para probar animaciones en jsdom. */
import { vi } from "vitest";

type Oyente = (e: { matches: boolean }) => void;
let reducir = false;
const oyentes = new Set<Oyente>();

const esConsultaDeMovimiento = (q: string) => /prefers-reduced-motion/.test(q) && !/no-preference/.test(q);

/** Instala un `matchMedia` en el que solo la preferencia de movimiento puede ser verdadera. */
export function instalarMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const mq = {
        media: query,
        onchange: null,
        get matches() {
          return esConsultaDeMovimiento(query) ? reducir : false;
        },
        addEventListener: (_: string, fn: Oyente) => oyentes.add(fn),
        removeEventListener: (_: string, fn: Oyente) => oyentes.delete(fn),
        addListener: (fn: Oyente) => oyentes.add(fn),
        removeListener: (fn: Oyente) => oyentes.delete(fn),
        dispatchEvent: () => false,
      };
      return mq;
    },
  });
}

/** Simula «reducir movimiento» del sistema y avisa a quien escuche (motion guarda el valor). */
export function reducirMovimiento(valor: boolean) {
  reducir = valor;
  for (const fn of oyentes) fn({ matches: valor });
}

export interface ObservadorFalso {
  /** Simula que el elemento observado entra (o sale) de la pantalla. */
  disparar: (visible: boolean) => void;
  observados: Element[];
}

/** Instala un `IntersectionObserver` controlable. Devuelve los observadores creados. */
export function instalarIntersectionObserver(): ObservadorFalso[] {
  const creados: ObservadorFalso[] = [];
  class IO {
    observados: Element[] = [];
    constructor(private cb: IntersectionObserverCallback) {
      creados.push({
        observados: this.observados,
        disparar: (visible) =>
          this.cb(
            this.observados.map((target) => ({ isIntersecting: visible, target }) as IntersectionObserverEntry),
            this as unknown as IntersectionObserver,
          ),
      });
    }
    observe(el: Element) {
      this.observados.push(el);
    }
    unobserve() {}
    disconnect() {
      this.observados.length = 0;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return creados;
}

/** Hace que todo elemento parezca estar más abajo de la pantalla (fuera de la vista inicial). */
export function todoBajoElPliegue() {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 5000,
    bottom: 5400,
    left: 0,
    right: 800,
    width: 800,
    height: 400,
    x: 0,
    y: 5000,
    toJSON: () => ({}),
  } as DOMRect);
}
