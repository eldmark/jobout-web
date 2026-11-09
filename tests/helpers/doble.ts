import { act, fireEvent } from "@testing-library/react";

/**
 * Dos clics dentro del mismo lote de React: el segundo ocurre ANTES de que el primero haya
 * deshabilitado el botón. Es lo que de verdad prueba la guarda contra el doble envío (si no, el
 * botón ya deshabilitado oculta una guarda rota).
 */
export function dobleClic(el: Element): void {
  act(() => {
    fireEvent.click(el);
    fireEvent.click(el);
  });
}
