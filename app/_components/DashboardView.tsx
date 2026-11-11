import Link from "next/link";
import DeleteAccount from "./DeleteAccount";
import LogoutButton from "./LogoutButton";
import { navFor } from "@/lib/auth/menu";
import { t } from "@/lib/messages";

export interface Me {
  first_name: string;
  last_name: string;
  plan: { code: string; name: string };
  /** Códigos de rol de `GET /me`: eligen el menú, no autorizan nada. */
  roles?: string[];
}

export default function DashboardView({
  me,
  completeProfile = false,
  activeInterviewId = null,
}: {
  me: Me | null;
  completeProfile?: boolean;
  /** Id de la entrevista en curso o en pausa, si la hay. */
  activeInterviewId?: string | null;
}) {
  const enlaces = me ? navFor(me.roles ?? []) : [];
  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      {me ? (
        <>
          <h1>
            {t("dashboard.greeting")} {me.first_name}
          </h1>
          <p className="etiqueta">
            {t("dashboard.plan")} {me.plan.name}
          </p>
          {enlaces.length > 0 ? (
            <nav aria-label={t("dashboard.nav.label")}>
              <ul className="menu">
                {enlaces.map((l) => (
                  <li key={l.href}>
                    <Link className="boton boton--borde" href={l.href}>
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <p className="aviso">{t("dashboard.empty")}</p>
          <p>
            {activeInterviewId ? (
              <Link className="boton boton--coral" href={`/interviews/${activeInterviewId}`}>
                {t("dashboard.resume")}
              </Link>
            ) : (
              <Link className="boton boton--coral" href="/interviews">
                {t("dashboard.practice")}
              </Link>
            )}
          </p>
          {completeProfile ? (
            <section className="aviso aviso--accion" aria-labelledby="completa-perfil">
              <h2 id="completa-perfil">{t("dashboard.completeProfile")}</h2>
              <p>{t("dashboard.completeProfileHint")}</p>
              <a className="boton boton--coral" href="/profile/cv">
                {t("dashboard.completeProfile")}
              </a>
            </section>
          ) : null}
        </>
      ) : (
        <>
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
