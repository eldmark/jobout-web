/** Matching (5b): el desglose del puntaje, para la persona y para el reclutador. Nunca solo color. */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MATCH } from "./helpers/offers";
import { t, tf } from "@/lib/messages";
import MatchBreakdown from "@/app/_components/MatchBreakdown";
import type { Match } from "@/lib/offers/types";

afterEach(cleanup);
const m = (over: Record<string, unknown> = {}) => MATCH(67, over) as unknown as Match;
const componente = (nombre: string) => screen.getByRole("heading", { name: nombre }).closest("li") as HTMLElement;

describe("para la persona", () => {
  it("una sección con nombre: «Afinidad con tu perfil», el puntaje en texto y la explicación corta", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const s = screen.getByRole("region", { name: t("match.title.candidate") });
    expect(within(s).getByRole("heading", { level: 2, name: t("match.title.candidate") })).toBeInTheDocument();
    expect(s).toHaveTextContent("Afinidad 67 %");
    expect(s).toHaveTextContent(t("match.explain.candidate"));
  });
  it("los cuatro componentes en orden, cada uno con sus puntos sobre su peso", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const nombres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(nombres).toEqual([t("match.component.skills"), t("match.component.languages"), t("match.component.experience"), t("match.component.academic_level")]);
    expect(componente(t("match.component.skills"))).toHaveTextContent(tf("match.points", { points: "33,3", weight: 50 }));
    expect(componente(t("match.component.languages"))).toHaveTextContent(tf("match.points", { points: "15", weight: 15 }));
  });
  it("habilidades: cumple / cumple en parte / no cumple, con obligatoria o deseable y los niveles", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const c = componente(t("match.component.skills"));
    const grupo = (k: Parameters<typeof t>[0]) => within(c).getByRole("list", { name: t(k) });
    expect(grupo("match.group.matched")).toHaveTextContent("Rust");
    expect(grupo("match.group.matched")).toHaveTextContent(t("offer.skill.required"));
    expect(grupo("match.group.partial")).toHaveTextContent("Go");
    expect(grupo("match.group.partial")).toHaveTextContent(t("offer.skill.optional"));
    expect(grupo("match.group.partial")).toHaveTextContent(tf("offer.skill.minLevel", { level: t("form.level.advanced") }));
    expect(grupo("match.group.partial")).toHaveTextContent(tf("match.level.current", { level: t("form.level.intermediate") }));
    expect(grupo("match.group.missing")).toHaveTextContent("SQL");
  });
  it("una habilidad a medias sin nivel registrado lo dice", () => {
    const base = MATCH();
    const comp = base.breakdown.components as Array<Record<string, unknown>>;
    (comp[0].partial as Array<Record<string, unknown>>)[0].level = null;
    render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(componente(t("match.component.skills"))).toHaveTextContent(t("match.level.none"));
  });
  it("idiomas: cumple y no cumple con el nivel pedido y el tuyo; un grupo vacío no se pinta", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const c = componente(t("match.component.languages"));
    expect(within(c).getByRole("list", { name: t("match.group.matched") })).toHaveTextContent("Inglés");
    expect(within(c).getByRole("list", { name: t("match.group.matched") })).toHaveTextContent(tf("match.level.current", { level: t("form.proficiency.advanced") }));
    expect(within(c).getByRole("list", { name: t("match.group.missing") })).toHaveTextContent("Francés");
    expect(within(c).getByRole("list", { name: t("match.group.missing") })).toHaveTextContent(tf("offer.language.minLevel", { level: t("form.proficiency.basic") }));
    expect(within(c).queryByRole("list", { name: t("match.group.partial") })).toBeNull();
  });
  it("experiencia: años pedidos frente a años tuyos", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    expect(componente(t("match.component.experience"))).toHaveTextContent(tf("match.experience.candidate", { required: "4 años", years: "2 años" }));
  });
  it("experiencia con un año y con decimales", () => {
    const base = MATCH();
    Object.assign((base.breakdown.components as Array<Record<string, unknown>>)[2], { required_years: 1, years: 0.5 });
    render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(componente(t("match.component.experience"))).toHaveTextContent(tf("match.experience.candidate", { required: "1 año", years: "0,5 años" }));
  });
  it("nivel académico: dice si se cumple o no", () => {
    const base = MATCH();
    Object.assign((base.breakdown.components as Array<Record<string, unknown>>)[3], { applies: true, points: 15, reason: undefined });
    const { unmount } = render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(componente(t("match.component.academic_level"))).toHaveTextContent(t("match.academic.met"));
    unmount();
    Object.assign((base.breakdown.components as Array<Record<string, unknown>>)[3], { points: 0 });
    render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(componente(t("match.component.academic_level"))).toHaveTextContent(t("match.academic.notMet"));
  });
  it("un componente que no aplica se explica en español y no pinta listas ni puntos", () => {
    render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const c = componente(t("match.component.academic_level"));
    expect(c).toHaveTextContent(t("match.reason.no_pedido"));
    expect(c).not.toHaveTextContent(/puntos/);
    expect(within(c).queryByRole("list")).toBeNull();
  });
  it("perfil vacío: lo explica y enlaza al perfil", () => {
    const base = MATCH(0);
    base.breakdown.empty_profile = true;
    render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(screen.getByText(t("match.emptyProfile"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("match.profileLink") })).toHaveAttribute("href", "/profile");
  });
  it("sin requisitos comparables: lo explica", () => {
    const base = MATCH(0);
    (base.breakdown as { reason: string | null }).reason = "sin_requisitos_comparables";
    render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(screen.getByText(t("match.noComparable.candidate"))).toBeInTheDocument();
  });
  it("el estado no depende del color: todo es texto, y la barra es decorativa (aria-hidden)", () => {
    const { container } = render(<MatchBreakdown match={m()} viewer="candidate" level={2} />);
    const barra = container.querySelector(".afinidad__barra");
    expect(barra?.closest("[aria-hidden=true]")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("lo que viene de la oferta se pinta como texto, nunca como HTML", () => {
    const base = MATCH();
    (base.breakdown.components as Array<{ matched: Array<{ skill: { name: string } }> }>)[0].matched[0].skill.name = "<img src=x onerror=1>";
    const { container } = render(<MatchBreakdown match={base as unknown as Match} viewer="candidate" level={2} />);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("para el reclutador", () => {
  it("su propio título y su propia explicación (solo lo compartido), con encabezados de un nivel más abajo", () => {
    render(<MatchBreakdown match={m()} viewer="recruiter" level={3} />);
    const s = screen.getByRole("region", { name: t("match.title.recruiter") });
    expect(within(s).getByRole("heading", { level: 3, name: t("match.title.recruiter") })).toBeInTheDocument();
    expect(within(s).getAllByRole("heading", { level: 4 })).toHaveLength(4);
    expect(s).toHaveTextContent(t("match.explain.recruiter"));
    expect(s).toHaveTextContent("Afinidad 67 %");
    expect(s).not.toHaveTextContent(t("match.explain.candidate"));
  });
  it("un componente no_compartido dice «La persona no compartió este dato»", () => {
    const base = MATCH();
    Object.assign((base.breakdown.components as Array<Record<string, unknown>>)[1], { applies: false, points: 0, reason: "no_compartido", matched: undefined, partial: undefined, missing: undefined });
    render(<MatchBreakdown match={base as unknown as Match} viewer="recruiter" level={3} />);
    expect(componente(t("match.component.languages"))).toHaveTextContent("La persona no compartió este dato");
  });
  it("experiencia con la voz del reclutador; el perfil vacío no manda a la persona a ningún perfil", () => {
    const base = MATCH(0);
    base.breakdown.empty_profile = true;
    render(<MatchBreakdown match={base as unknown as Match} viewer="recruiter" level={3} />);
    expect(componente(t("match.component.experience"))).toHaveTextContent(tf("match.experience.recruiter", { required: "4 años", years: "2 años" }));
    expect(screen.queryByRole("link")).toBeNull();
  });
});
