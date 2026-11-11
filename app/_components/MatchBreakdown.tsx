import Link from "next/link";
import { formatPoints, isMatch } from "@/lib/offers/match";
import type { Match, MatchComponent, MatchLanguage, MatchSkill } from "@/lib/offers/types";
import { t, tf } from "@/lib/messages";

type Viewer = "candidate" | "recruiter";
type Fila = MatchSkill | MatchLanguage;

const anios = (n: number): string => (n === 1 ? t("match.yearsOne") : tf("match.years", { n: formatPoints(n) }));

function Habilidad({ x }: { x: MatchSkill }) {
  return (
    <li>
      {x.skill.name}
      {" · "}
      {t(x.required ? "offer.skill.required" : "offer.skill.optional")}
      {x.min_level ? `${" · "}${tf("offer.skill.minLevel", { level: t(`form.level.${x.min_level}`) })}` : null}
      {x.level ? `${" · "}${tf("match.level.current", { level: t(`form.level.${x.level}`) })}` : null}
      {"level" in x && !x.level && x.min_level ? `${" · "}${t("match.level.none")}` : null}
    </li>
  );
}

function Idioma({ x }: { x: MatchLanguage }) {
  return (
    <li>
      {x.language.name}
      {x.min_proficiency ? `${" · "}${tf("offer.language.minLevel", { level: t(`form.proficiency.${x.min_proficiency}`) })}` : null}
      {x.proficiency ? `${" · "}${tf("match.level.current", { level: t(`form.proficiency.${x.proficiency}`) })}` : null}
    </li>
  );
}

/** Una lista con nombre («Cumple», «Cumple en parte», «No cumple»); vacía, no se pinta. */
function Grupo({ clave, items, tipo }: { clave: "matched" | "partial" | "missing"; items: Fila[] | undefined; tipo: "skills" | "languages" }) {
  if (!items || items.length === 0) return null;
  const id = `afinidad-${tipo}-${clave}`;
  const filas = items.map((x, i) => {
    if (tipo === "skills") {
      return <Habilidad key={`${(x as MatchSkill).skill.id}-${i}`} x={x as MatchSkill} />;
    }
    return <Idioma key={`${(x as MatchLanguage).language.id}-${i}`} x={x as MatchLanguage} />;
  });
  return (
    <>
      <p className="afinidad__grupo" id={id}>
        {t(`match.group.${clave}`)}
      </p>
      <ul aria-labelledby={id}>{filas}</ul>
    </>
  );
}

function Cuerpo({ c, viewer }: { c: MatchComponent; viewer: Viewer }) {
  if (!c.applies) return <p>{t(c.reason === "no_compartido" ? "match.reason.no_compartido" : "match.reason.no_pedido")}</p>;
  if (c.key === "skills" || c.key === "languages") {
    return (
      <>
        <Grupo clave="matched" items={c.matched} tipo={c.key} />
        <Grupo clave="partial" items={c.partial} tipo={c.key} />
        <Grupo clave="missing" items={c.missing} tipo={c.key} />
      </>
    );
  }
  if (c.key === "experience") {
    if (typeof c.required_years !== "number" || typeof c.years !== "number") return null;
    return <p>{tf(viewer === "candidate" ? "match.experience.candidate" : "match.experience.recruiter", { required: anios(c.required_years), years: anios(c.years) })}</p>;
  }
  return <p>{t(c.points >= c.weight ? "match.academic.met" : "match.academic.notMet")}</p>;
}

/**
 * La afinidad con una oferta: el puntaje en texto, una explicación corta y el desglose por criterio.
 * La persona lo ve en el detalle de la oferta; el reclutador, solo si ella lo compartió. Nada depende
 * del color: todo estado es texto y la barra es decorativa. Todo lo que viene de la oferta se pinta como texto.
 */
export default function MatchBreakdown({ match, viewer, level }: { match: Match; viewer: Viewer; level: 2 | 3 }) {
  if (!isMatch(match)) return null;
  const Titulo = level === 2 ? "h2" : "h3";
  const Sub = level === 2 ? "h3" : "h4";
  const idTitulo = `afinidad-titulo-${viewer}`;
  const { breakdown } = match;
  return (
    <section className="afinidad" aria-labelledby={idTitulo}>
      <Titulo id={idTitulo}>{t(viewer === "candidate" ? "match.title.candidate" : "match.title.recruiter")}</Titulo>
      <p className="afinidad__puntaje">{tf("match.score", { n: match.score })}</p>
      <div className="afinidad__pista" aria-hidden="true">
        <div className="afinidad__barra" style={{ width: `${match.score}%` }} />
      </div>
      <p className="campo__ayuda">{t(viewer === "candidate" ? "match.explain.candidate" : "match.explain.recruiter")}</p>
      {breakdown.reason === "sin_requisitos_comparables" ? <p className="aviso">{t(viewer === "candidate" ? "match.noComparable.candidate" : "match.noComparable.recruiter")}</p> : null}
      {breakdown.empty_profile && viewer === "candidate" ? (
        <p className="aviso">
          {t("match.emptyProfile")} <Link href="/profile">{t("match.profileLink")}</Link>
        </p>
      ) : null}
      <ol className="afinidad__lista" aria-label={t("match.breakdown")}>
        {breakdown.components.map((c) => (
          <li key={c.key}>
            <Sub>{t(`match.component.${c.key}`)}</Sub>
            {c.applies ? <p className="campo__ayuda">{tf("match.points", { points: formatPoints(c.points), weight: formatPoints(c.weight) })}</p> : null}
            <Cuerpo c={c} viewer={viewer} />
          </li>
        ))}
      </ol>
    </section>
  );
}
