import Link from "next/link";
import type { CSSProperties } from "react";
import DeleteAccount from "./DeleteAccount";
import LogoutButton from "./LogoutButton";
import CandidateStats from "./dashboard/CandidateStats";
import CountUp from "./dashboard/CountUp";
import OffersSearch from "./dashboard/OffersSearch";
import { Estado, Kpi, type Color } from "./dashboard/Tiles";
import { Icono, type IconName } from "./dashboard/icons";
import { navFor, showsCandidateBlocks, type NavLink } from "@/lib/auth/menu";
import type { AdminData, CandidateData, CompanyData } from "@/lib/dashboard/data";
import { t, tf, type MessageKey } from "@/lib/messages";

export interface Me {
  first_name: string;
  last_name: string;
  plan: { code: string; name: string };
  /** Códigos de rol de `GET /me`: eligen el menú, no autorizan nada. */
  roles?: string[];
}

const COLORES: Color[] = ["indigo"];
const ICONO_DE: Record<string, IconName> = {
  "/offers": "offers",
  "/applications": "send",
  "/company": "building",
  "/company/offers": "list",
  "/admin/companies": "shield",
};

/** Atajos que solo ve quien practica y busca empleo (BUG-018): perfil, CV e historial. */
const ATAJOS_CANDIDATO: { href: string; key: MessageKey; icon: IconName }[] = [
  { href: "/profile", key: "dashboard.shortcuts.profile", icon: "user" },
  { href: "/profile/cv", key: "dashboard.shortcuts.cv", icon: "file" },
  { href: "/interviews/progress", key: "dashboard.shortcuts.history", icon: "clock" },
];

/** Cifra de una tarjeta de empresa: «al menos» (`12+`) si el backend tiene más páginas que las leídas. */
function Cifra({ value, partial }: { value: number; partial: boolean }) {
  return partial ? (
    <>
      {value}+
    </>
  ) : (
    <CountUp value={value} />
  );
}

function HeroCta({ candidato, esEmpresa, activeInterviewId }: { candidato: boolean; esEmpresa: boolean; activeInterviewId: string | null }) {
  if (candidato && activeInterviewId) {
    return (
      <Link className="boton boton--coral" href={`/interviews/${activeInterviewId}`}>
        {t("dashboard.resume")}
      </Link>
    );
  }
  if (candidato) {
    return (
      <Link className="boton boton--coral" href="/interviews">
        {t("dashboard.practice")}
      </Link>
    );
  }
  if (esEmpresa) {
    return (
      <Link className="boton boton--coral" href="/company/offers">
        {t("dashboard.company.cta")}
      </Link>
    );
  }
  return (
    <Link className="boton boton--coral" href="/admin/companies">
      {t("dashboard.admin.cta")}
    </Link>
  );
}

/** Texto bajo la verificación: lo que falta, o el estado de la membresía. */
function notaVerificacion(c: CompanyData): string | null {
  if (!c.verified) return t("dashboard.company.unverifiedHint");
  if (c.membership === "active") return t("dashboard.company.membershipActive");
  if (c.membership === "expired") return t("dashboard.company.membershipExpired");
  return null;
}

function Orbitas() {
  return (
    <svg className="heroe__orbitas" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="68" strokeDasharray="3 7" />
      <circle cx="100" cy="100" r="40" />
      <circle cx="100" cy="4" r="5" fill="currentColor" stroke="none" />
      <circle cx="168" cy="100" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function DashboardView({
  me,
  completeProfile = false,
  activeInterviewId = null,
  candidate = null,
  company = null,
  admin = null,
  nowIso = new Date().toISOString(),
}: {
  me: Me | null;
  completeProfile?: boolean;
  /** Id de la entrevista en curso o en pausa, si la hay. */
  activeInterviewId?: string | null;
  /** Lecturas del servidor para el panel de la persona candidata; null = no se leyeron. */
  candidate?: CandidateData | null;
  company?: CompanyData | null;
  admin?: AdminData | null;
  /** Instante del servidor: «hoy» es el mismo al renderizar y al hidratar. */
  nowIso?: string;
}) {
  const roles = me?.roles ?? [];
  const enlaces: NavLink[] = me ? navFor(roles) : [];
  const candidato = showsCandidateBlocks(roles);
  const esEmpresa = roles.includes("company_admin") || roles.includes("recruiter");
  const esAdmin = roles.includes("admin");
  const practicas = candidate?.points?.length ?? 0;

  let textoHeroe: string;
  if (candidato) textoHeroe = practicas === 0 ? t("dashboard.empty") : practicas === 1 ? t("dashboard.hero.progressOne") : tf("dashboard.hero.progress", { n: practicas });
  else if (esAdmin && !esEmpresa) textoHeroe = t("dashboard.admin.hero");
  else textoHeroe = t("dashboard.company.hero");

  return (
    <main className="pagina pagina--panel">
      {me ? (
        <>
          <header className="heroe">
            <p className="marca">{t("brand.name")}</p>
            <h1>
              {t("dashboard.greeting")} {me.first_name}
            </h1>
            <p className="heroe__texto">{textoHeroe}</p>
            <div className="heroe__pie">
              <p className="etiqueta">
                {t("dashboard.plan")} {me.plan.name}
              </p>
              <HeroCta candidato={candidato} esEmpresa={esEmpresa} activeInterviewId={activeInterviewId} />
            </div>
            <Orbitas />
          </header>

          {candidato && candidate ? <OffersSearch professions={candidate.professions} contractTypes={candidate.contractTypes} /> : null}

          {candidato && candidate ? (
            <CandidateStats points={candidate.points} applications={candidate.applications} hasCv={candidate.hasCv} hasSkills={candidate.hasSkills} nowIso={nowIso} />
          ) : null}

          {enlaces.length > 0 ? (
            <nav aria-label={t("dashboard.nav.label")}>
              <ul className="atajos">
                {enlaces.map((l, i) => (
                  <li key={l.href + l.key} style={{ "--i": i } as CSSProperties}>
                    <Link className={`atajo c-${COLORES[i % COLORES.length]}`} href={l.href}>
                      <span className="icono-chip">
                        <Icono name={ICONO_DE[l.href] ?? "list"} />
                      </span>
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {candidato ? (
            <nav aria-label={t("dashboard.shortcuts.label")}>
              <ul className="atajos">
                {ATAJOS_CANDIDATO.map((a, i) => (
                  <li key={a.href} style={{ "--i": i + enlaces.length } as CSSProperties}>
                    <Link className={`atajo c-${COLORES[(i + enlaces.length) % COLORES.length]}`} href={a.href}>
                      <span className="icono-chip">
                        <Icono name={a.icon} />
                      </span>
                      {t(a.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {candidato && completeProfile ? (
            <section className="aviso aviso--accion" aria-labelledby="completa-perfil">
              <h2 id="completa-perfil">{t("dashboard.completeProfile")}</h2>
              <p>{t("dashboard.completeProfileHint")}</p>
              <a className="boton boton--coral" href="/profile/cv">
                {t("dashboard.completeProfile")}
              </a>
            </section>
          ) : null}

          {esEmpresa && company ? (
            <section className="panel-seccion" aria-labelledby="panel-empresa">
              <h2 id="panel-empresa">{t("dashboard.company.title")}</h2>
              <ul className="panel-lista">
                <Kpi id="kpi-publicadas" color="indigo" icon="offers" label={t("dashboard.company.published")} index={0}>
                  <p className="kpi__valor">
                    <Cifra value={company.offersPublished} partial={company.partial} />
                  </p>
                </Kpi>
                <Kpi id="kpi-recibidas" color="mint" icon="inbox" label={t("dashboard.company.received")} index={1}>
                  <p className="kpi__valor">
                    <Cifra value={company.received} partial={company.partial} />
                  </p>
                  <p className="kpi__nota">{t("dashboard.company.receivedHint")}</p>
                </Kpi>
                <Kpi id="kpi-ofertas" color="indigo" icon="list" label={t("dashboard.company.total")} index={2}>
                  <p className="kpi__valor">
                    <Cifra value={company.offersTotal} partial={company.partial} />
                  </p>
                </Kpi>
                {company.verified !== null ? (
                  <Kpi id="kpi-verificacion" color="indigo" icon="shield" label={t("dashboard.company.verification")} index={3}>
                    <Estado color={company.verified ? "mint" : "coral"}>{company.verified ? t("dashboard.company.verified") : t("dashboard.company.unverified")}</Estado>
                    <p className="kpi__nota">{notaVerificacion(company)}</p>
                  </Kpi>
                ) : null}
              </ul>
            </section>
          ) : null}

          {esAdmin && admin ? (
            <section className="panel-seccion" aria-labelledby="panel-admin">
              <h2 id="panel-admin">{t("dashboard.admin.title")}</h2>
              <ul className="panel-lista">
                <Kpi id="kpi-pendientes" color="indigo" icon="shield" label={t("dashboard.admin.pending")} index={0} wide>
                  <p className="kpi__valor">
                    <Cifra value={admin.pending} partial={admin.partial} />
                  </p>
                  <p className="kpi__nota">{t("dashboard.admin.pendingHint")}</p>
                </Kpi>
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <p className="marca">{t("brand.name")}</p>
          <h1>{t("brand.name")}</h1>
          <p className="formulario__error" role="alert">
            {t("dashboard.error")}
          </p>
          <p>
            <a href="/dashboard">{t("dashboard.retry")}</a>
          </p>
        </>
      )}
      <div className="acciones">
        <LogoutButton />
        <DeleteAccount />
      </div>
    </main>
  );
}
