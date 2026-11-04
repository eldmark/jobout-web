import Link from "next/link";

import { t } from "@/lib/messages";

export default function Home() {
  return (
    <main className="pagina">
      <span className="etiqueta">{t("home.badge")}</span>
      <h1>{t("brand.name")}</h1>
      <p className="eslogan">{t("brand.slogan")}</p>
      <p className="aviso">{t("home.notice")}</p>
      <div className="acciones">
        <Link className="boton boton--coral" href="/sign-up">
          {t("home.signUp")}
        </Link>
        <Link className="boton boton--borde" href="/sign-in">
          {t("home.signIn")}
        </Link>
      </div>
    </main>
  );
}
