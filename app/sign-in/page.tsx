import AuthForm from "@/app/_components/AuthForm";
import AuthShell from "@/app/_components/AuthShell";
import { t } from "@/lib/messages";

export default function SignInPage() {
  return (
    <AuthShell>
      <h1 className="m-0 font-display text-4xl font-bold tracking-tight text-ink dark:text-white">{t("auth.signIn.title")}</h1>
      <p className="mt-3 mb-8 text-lg text-ink/70 dark:text-lavender/75">{t("auth.signIn.subtitle")}</p>
      <AuthForm kind="login" />
    </AuthShell>
  );
}
