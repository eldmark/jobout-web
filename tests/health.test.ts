/**
 * Casos de verdad de la ruta de salud.
 * Se escribieron antes que la implementación, en rojo. Ver CONTRIBUTING.md.
 */
import { describe, it, expect } from "vitest";
import { GET } from "@/app/health/route";

describe("GET /health", () => {
  it("responde 200 con status ok", async () => {
    const respuesta = GET();
    expect(respuesta.status).toBe(200);

    const cuerpo = await respuesta.json();
    expect(cuerpo.status).toBe("ok");
    expect(cuerpo.service).toBe("jobout-web");
  });

  it("no expone ningún dato de usuario", async () => {
    // Es una ruta pública: todo lo que devuelva es visible sin autenticación,
    // así que la prueba fija qué campos puede traer.
    const cuerpo = await GET().json();
    const permitidos = ["status", "service", "version"];

    for (const campo of Object.keys(cuerpo)) {
      expect(permitidos, `/health devolvió el campo inesperado '${campo}'`).toContain(campo);
    }
  });
});
