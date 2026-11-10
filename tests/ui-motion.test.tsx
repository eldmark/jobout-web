/** Rediseño (jb-55): animaciones que nunca esconden contenido y que respetan «reducir movimiento». */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import Reveal from "@/app/_components/ui/reveal";
import TextRotate from "@/app/_components/ui/text-rotate";
import BackgroundPaths from "@/app/_components/ui/background-paths";
import ContainerScroll from "@/app/_components/ui/container-scroll";
import { instalarIntersectionObserver, reducirMovimiento, todoBajoElPliegue } from "./helpers/movimiento";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  reducirMovimiento(false);
});

const OCULTO_EN_HTML = /opacity:\s*0(?![.\d])/;

describe("Reveal: aparece al bajar, nunca esconde contenido", () => {
  const caja = (texto: string) => screen.getByText(texto).parentElement!;

  it("V5: el HTML del servidor muestra el contenido, sin opacity:0", () => {
    const html = renderToString(
      <Reveal>
        <p>hola</p>
      </Reveal>,
    );
    expect(html).toContain("hola");
    expect(html).not.toMatch(OCULTO_EN_HTML);
  });

  it("lo que ya está en pantalla al cargar no se esconde", () => {
    instalarIntersectionObserver();
    render(
      <Reveal>
        <p>arriba</p>
      </Reveal>,
    );
    expect(caja("arriba")).toHaveAttribute("data-reveal", "visible");
  });

  it("lo que está más abajo espera a entrar en pantalla y entonces aparece", () => {
    const observadores = instalarIntersectionObserver();
    todoBajoElPliegue();
    render(
      <Reveal>
        <p>abajo</p>
      </Reveal>,
    );
    expect(caja("abajo")).toHaveAttribute("data-reveal", "oculto");
    act(() => observadores[0].disparar(true));
    expect(caja("abajo")).toHaveAttribute("data-reveal", "entrando");
  });

  it("V6: sin IntersectionObserver no esconde nada", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    todoBajoElPliegue();
    render(
      <Reveal>
        <p>sin observador</p>
      </Reveal>,
    );
    expect(caja("sin observador")).toHaveAttribute("data-reveal", "visible");
  });

  it("V4: con «reducir movimiento» no esconde nada", () => {
    reducirMovimiento(true);
    instalarIntersectionObserver();
    todoBajoElPliegue();
    render(
      <Reveal>
        <p>quieto</p>
      </Reveal>,
    );
    expect(caja("quieto")).toHaveAttribute("data-reveal", "visible");
  });
});

describe("TextRotate", () => {
  const nombres = ["Ana", "Martín", "Laura"];
  const leido = (c: HTMLElement) => c.querySelector(".sr-only")?.textContent;

  it("V11: el lector de pantalla lee el texto actual una vez; las letras animadas están ocultas", () => {
    const { container } = render(<TextRotate texts={nombres} />);
    expect(leido(container)).toBe("Ana");
    const actual = container.querySelector("[data-actual]");
    expect(actual).toHaveAttribute("aria-hidden", "true");
    expect(actual?.textContent).toBe("Ana");
  });

  // Revisión de Lázaro: la pastilla cambiaba de tamaño con cada texto y movía todo el renglón.
  it("anchoFijo: reserva el ancho del texto más largo con copias invisibles de todos los textos", () => {
    const { container } = render(<TextRotate texts={nombres} anchoFijo />);
    const medidas = [...container.querySelectorAll("[data-medida]")];
    expect(medidas.map((m) => m.textContent)).toEqual(nombres);
    for (const m of medidas) {
      expect(m).toHaveClass("invisible");
      expect(m).toHaveAttribute("aria-hidden", "true");
    }
    expect(leido(container)).toBe("Ana");
  });

  it("sin anchoFijo no agrega copias de medida", () => {
    const { container } = render(<TextRotate texts={nombres} />);
    expect(container.querySelectorAll("[data-medida]")).toHaveLength(0);
  });

  it("rota al siguiente texto en cada intervalo y vuelve al primero", () => {
    vi.useFakeTimers();
    const { container } = render(<TextRotate texts={nombres} rotationInterval={1000} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(leido(container)).toBe("Martín");
    act(() => vi.advanceTimersByTime(2000));
    expect(leido(container)).toBe("Ana");
  });

  it("V4: con «reducir movimiento» se queda en el primero", () => {
    reducirMovimiento(true);
    vi.useFakeTimers();
    const { container } = render(<TextRotate texts={nombres} rotationInterval={1000} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(leido(container)).toBe("Ana");
  });
});

describe("BackgroundPaths (Kokonut UI, adaptado)", () => {
  it("V3: el lienzo es decorativo, sin foco ni clics; el contenido encima sí se ve", () => {
    const { container } = render(
      <BackgroundPaths>
        <p>contenido</p>
      </BackgroundPaths>,
    );
    const lienzo = container.querySelector("canvas")!;
    expect(lienzo.closest("[aria-hidden='true']")).not.toBeNull();
    expect(lienzo.closest(".pointer-events-none")).not.toBeNull();
    expect(lienzo).not.toHaveAttribute("tabindex");
    expect(screen.getByText("contenido")).toBeVisible();
  });

  it("sin contexto 2D ni observadores (navegadores viejos, jsdom) no rompe la página", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(() => render(<BackgroundPaths />)).not.toThrow();
  });
});

describe("ContainerScroll (Aceternity, adaptado)", () => {
  const tarjeta = () => screen.getByText("adentro").closest("[data-scroll-card]")!;
  const montar = () =>
    render(
      <ContainerScroll titleComponent={<h2>titulo</h2>}>
        <p>adentro</p>
      </ContainerScroll>,
    );

  it("sin reducir movimiento la tarjeta empieza inclinada", () => {
    montar();
    expect(tarjeta().getAttribute("style") ?? "").toMatch(/rotateX\(20deg\)/);
  });

  it("V4: con «reducir movimiento» la tarjeta queda derecha", () => {
    reducirMovimiento(true);
    montar();
    expect(tarjeta().getAttribute("style") ?? "").not.toMatch(/rotateX\((?!0deg)/);
  });

  it("V5: el HTML del servidor muestra el contenido", () => {
    const html = renderToString(
      <ContainerScroll titleComponent={<h2>titulo</h2>}>
        <p>adentro</p>
      </ContainerScroll>,
    );
    expect(html).toContain("adentro");
    expect(html).not.toMatch(OCULTO_EN_HTML);
  });
});
