import AuthForm from "@/app/_components/AuthForm";
import { t } from "@/lib/messages";

export default function SignInPage() {
  return (
    <main className="pagina pagina--auth">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("auth.signIn.title")}</h1>
      <p className="eslogan">{t("auth.signIn.subtitle")}</p>
      <AuthForm kind="login" />
    </main>
  );
}
