/**
 * BUG-001: antes de hidratar, un `<form>` sin `method` se envía por GET y deja los campos
 * (contraseña incluida) en la URL, el historial y el log del servidor.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import SignUpPage from "@/app/sign-up/page";
import SignInPage from "@/app/sign-in/page";
import { leer, listar } from "./helpers/fuentes";

vi.mock("@/lib/navigate", () => ({ goTo: vi.fn() }));

/** Etiquetas de apertura `<form ...>` de un HTML ya renderizado. */
const formularios = (html: string) => html.match(/<form\b[^>]*>/g) ?? [];

describe("BUG-001: ningún formulario se envía por GET", () => {
  it.each([
    ["/sign-up", SignUpPage],
    ["/sign-in", SignInPage],
  ])("H1: el HTML del servidor de %s trae el formulario con method=post", (_ruta, Pagina) => {
    const forms = formularios(renderToString(<Pagina />));
    expect(forms.length).toBe(1);
    expect(forms[0]).toMatch(/\smethod="post"/);
  });

  it('H2: todo <form> de app/ declara method="post" como primer atributo', () => {
    const archivos = listar("app").filter((f) => f.endsWith(".tsx"));
    let total = 0;
    for (const f of archivos) {
      const fuente = leer(f);
      const abiertos = fuente.match(/<form(?=[\s>])/g)?.length ?? 0;
      const conPost = fuente.match(/<form\s+method="post"/g)?.length ?? 0;
      expect(conPost, `${f}: cada <form> empieza con method="post"`).toBe(abiertos);
      total += abiertos;
    }
    // Si el escaneo no encuentra formularios, la prueba no estaría probando nada.
    expect(total).toBeGreaterThanOrEqual(5);
  });
});
