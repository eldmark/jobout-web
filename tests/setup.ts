import "@testing-library/jest-dom/vitest";
import { instalarMatchMedia } from "./helpers/movimiento";

// jsdom no implementa matchMedia (la usan motion y los fondos animados) ni el contexto 2D del
// canvas. Sin contexto, los fondos no dibujan nada: es lo mismo que pasa en un navegador sin canvas.
// Las pruebas de la capa servidor corren en entorno node, sin `window`: ahí no hay nada que instalar.
if (typeof window !== "undefined") {
  instalarMatchMedia();
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
