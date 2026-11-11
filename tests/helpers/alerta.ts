import { expect } from "vitest";
import { screen, waitFor, type waitForOptions } from "@testing-library/react";

/**
 * Espera a que la alerta del formulario **diga** `texto` y la devuelve.
 *
 * Los formularios dejan su `role="alert"` siempre en el DOM, vacío hasta que hay un error (así el lector
 * de pantalla anuncia el cambio). Por eso `findByRole("alert")` lo encuentra enseguida y no sirve para
 * esperar el mensaje (BUG-007).
 */
export async function alertaCon(texto: string | RegExp, opciones?: waitForOptions): Promise<HTMLElement> {
  return waitFor(() => {
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(texto);
    return alerta;
  }, opciones);
}
