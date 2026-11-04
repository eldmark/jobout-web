import Link from "next/link";
import { t } from "@/lib/messages";

export default function Adios() {
  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("goodbye.title")}</h1>
      <p className="eslogan">{t("goodbye.body")}</p>
      <Link className="boton boton--coral" href="/sign-up">
        {t("goodbye.cta")}
      </Link>
    </main>
  );
}
