import DeleteAccount from "./DeleteAccount";
import LogoutButton from "./LogoutButton";
import { t } from "@/lib/messages";

export interface Me {
  first_name: string;
  last_name: string;
  plan: { code: string; name: string };
}

export default function DashboardView({ me }: { me: Me | null }) {
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
