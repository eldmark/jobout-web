import DeleteAccount from "./DeleteAccount";
import LogoutButton from "./LogoutButton";
import { t } from "@/lib/messages";

export interface Me {
  first_name: string;
  last_name: string;
  plan: { code: string; name: string };
}

export default function DashboardView({ me, completeProfile = false }: { me: Me | null; completeProfile?: boolean }) {
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
          <p className="aviso">{t("dashboard.empty")}</p>
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
