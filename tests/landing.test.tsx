/** Rediseño de la portada (jb-55): casos V1, V2, V3, V5 y V7. */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import Home from "@/app/page";
import { t, tf, type MessageKey } from "@/lib/messages";
import { es } from "@/lib/messages/es";

afterEach(cleanup);

const enlace = (nombre: string) => screen.getByRole("link", { name: nombre });
const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const RECRUITERS = ["ana", "martin", "laura", "carlos", "sofia"] as const;
const NIVELES = ["junior", "startup", "amazon", "google", "mckinsey"] as const;

describe("Portada", () => {
  it("V1: un solo h1, el eslogan; el logo del encabezado dice JobOut y lleva al inicio", () => {
    render(<Home />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent(t("brand.slogan"));
    const logo = enlace(t("home.nav.homeLabel"));
    expect(logo).toHaveAttribute("href", "/");
    expect(logo).toHaveTextContent(t("brand.name"));
  });

  it("V2: el encabezado, el inicio y el cierre llevan al registro y al ingreso", () => {
    render(<Home />);
    expect(enlace(t("home.nav.signIn"))).toHaveAttribute("href", "/sign-in");
    expect(enlace(t("home.signUp"))).toHaveAttribute("href", "/sign-up");
    expect(enlace(t("home.signIn"))).toHaveAttribute("href", "/sign-in");
    expect(enlace(t("home.cta.button"))).toHaveAttribute("href", "/sign-up");
  });

  it("el menú lleva a secciones que existen, cada una con su título", () => {
    render(<Home />);
    const menu = screen.getByRole("navigation", { name: t("home.nav.label") });
    const anclas = within(menu)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href")!)
      .filter((h) => h.startsWith("#"));
    expect(anclas).toEqual(["#como-funciona", "#recruiters", "#niveles"]);
    for (const h of anclas) {
      const seccion = document.getElementById(h.slice(1));
      expect(seccion, h).not.toBeNull();
      expect(within(seccion!).getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
    }
  });

  // Revisión de Lázaro: quien entra por primera vez no sabe quiénes son Ana o Martín. El texto que
  // rota en la portada dice qué se practica; los recruiters se presentan más abajo.
  it("el titular rotativo dice qué tipo de entrevista se practica, sin nombres de recruiters", () => {
    render(<Home />);
    const frase = screen.getByText(t("home.hero.practice"), { exact: false }).closest("p")!;
    expect(frase.querySelector(".sr-only")).toHaveTextContent(t("home.hero.kind.technical"));
    for (const r of RECRUITERS) expect(frase).not.toHaveTextContent(t(`home.recruiters.${r}.name` as MessageKey));
  });

  // Revisión de Lázaro: sin el rectángulo coral. «Practica entrevistas» arriba y, debajo, el tipo
  // de entrevista en un color que resalte: coral en oscuro e índigo en claro (el coral sobre
  // blanco da 2.8:1 y no cumple contraste ni como texto grande).
  it("el tipo de entrevista va debajo de «Practica entrevistas», sin caja de fondo y en color de marca", () => {
    render(<Home />);
    const etiqueta = screen.getByText(t("home.hero.practice"));
    const rotativo = etiqueta.closest("p")!.querySelector("[data-medida]")!.parentElement!;
    expect(etiqueta.compareDocumentPosition(rotativo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rotativo.className).not.toMatch(/(^|\s)bg-/);
    expect(rotativo).toHaveClass("text-indigo", "dark:text-coral");
    expect(rotativo.className).not.toMatch(/(^|\s)text-coral\b/);
  });

  it("el titular rotativo tiene ancho fijo: mide con todos los tipos de entrevista", () => {
    render(<Home />);
    const frase = screen.getByText(t("home.hero.practice"), { exact: false }).closest("p")!;
    const medidas = [...frase.querySelectorAll("[data-medida]")].map((m) => m.textContent);
    expect(medidas).toEqual(
      ["technical", "hr", "behavioral", "english", "startup"].map((k) => t(`home.hero.kind.${k}` as MessageKey)),
    );
  });

  it("explica cómo funciona en tres pasos", () => {
    render(<Home />);
    const seccion = document.getElementById("como-funciona")!;
    for (const n of [1, 2, 3]) {
      expect(within(seccion).getByRole("heading", { name: t(`home.how.step${n}.title` as MessageKey) })).toBeInTheDocument();
    }
  });

  it("presenta a los cinco recruiters con su rol y su personalidad", () => {
    render(<Home />);
    const seccion = document.getElementById("recruiters")!;
    for (const r of RECRUITERS) {
      const nombre = t(`home.recruiters.${r}.name` as MessageKey);
      const tarjeta = within(seccion).getByRole("heading", { level: 3, name: nombre }).closest("article")!;
      expect(tarjeta).toHaveTextContent(t(`home.recruiters.${r}.role` as MessageKey));
      expect(tarjeta).toHaveTextContent(t(`home.recruiters.${r}.personality` as MessageKey));
    }
  });

  it("muestra los cinco niveles en orden y dice que los tres últimos llegan pronto", () => {
    render(<Home />);
    const lista = screen.getByRole("list", { name: t("home.levels.title") });
    const items = within(lista).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading").textContent)).toEqual(
      NIVELES.map((n) => t(`home.levels.${n}.name` as MessageKey)),
    );
    for (const li of items.slice(2)) expect(li).toHaveTextContent(t("home.levels.soon"));
    for (const li of items.slice(0, 2)) expect(li).not.toHaveTextContent(t("home.levels.soon"));
    // El orden lo dice cada tarjeta («Nivel 1»…); ya no hay una línea decorativa por detrás.
    items.forEach((li, i) => expect(li).toHaveTextContent(tf("home.levels.step", { n: i + 1 })));
    expect(lista.parentElement!.querySelector(".bg-gradient-to-r")).toBeNull();
  });

  it("V3: fondos animados decorativos; la vista previa de la sala tiene descripción y su maqueta se oculta", () => {
    const { container } = render(<Home />);
    const lienzos = container.querySelectorAll("canvas");
    expect(lienzos.length).toBeGreaterThan(0);
    for (const c of lienzos) expect(c.closest("[aria-hidden='true']")).not.toBeNull();
    const figura = screen.getByRole("figure", { name: t("home.preview.caption") });
    expect(figura.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("V5: sin JavaScript se ve todo: el HTML del servidor trae cada sección y nada con opacity:0", () => {
    const html = renderToString(<Home />);
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
    for (const k of ["brand.slogan", "home.how.title", "home.recruiters.title", "home.preview.title", "home.levels.title", "home.cta.title"] as MessageKey[]) {
      expect(html, k).toContain(escapar(t(k)));
    }
  });

  it("V7: no vende «IA»: ni la portada ni sus mensajes la nombran", () => {
    render(<Home />);
    const ia = /\bIA\b|inteligencia artificial|\bAI\b/i;
    expect(document.body.textContent).not.toMatch(ia);
    for (const [k, v] of Object.entries(es)) {
      if (/^(home|auth\.panel)\./.test(k)) expect(v, k).not.toMatch(ia);
    }
  });

  it("V7: los textos nuevos están en tuteo y ninguno queda sin usar", () => {
    const voseo = /\b(tenés|querés|podés|sabés|elegí|empezá|practicá|mirá|subí|respondé|registrate|ingresá)\b/i;
    for (const [k, v] of Object.entries(es)) {
      if (/^(home|auth\.panel|brand\.wordmark)\./.test(k)) expect(v, k).not.toMatch(voseo);
    }
  });
});
