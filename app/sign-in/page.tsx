import AuthForm from "@/app/_components/AuthForm";
import AuthShell from "@/app/_components/AuthShell";
import { t } from "@/lib/messages";

export default function SignInPage() {
  return (
    <AuthShell>
      <h1 className="m-0 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-white">{t("auth.signIn.title")}</h1>
      <p className="mt-2 mb-6 text-ink/70 dark:text-lavender/75">{t("auth.signIn.subtitle")}</p>
      <AuthForm kind="login" />
    </AuthShell>
  );
}
