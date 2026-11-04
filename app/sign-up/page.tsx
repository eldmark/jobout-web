import AuthForm from "@/app/_components/AuthForm";
import { t } from "@/lib/messages";

export default function SignUpPage() {
  return (
    <main className="pagina pagina--auth">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("auth.signUp.title")}</h1>
      <p className="eslogan">{t("auth.signUp.subtitle")}</p>
      <AuthForm kind="register" />
    </main>
  );
}
