import Logo from "@/app/_components/brand/Logo";
import { t, tf } from "@/lib/messages";

export default function Pie() {
  return (
    <footer className="border-t border-ink/10 px-6 py-10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-ink/60 sm:flex-row dark:text-lavender/60">
        <Logo className="text-lg" enlace={false} />
        <p className="m-0 text-center">{t("home.footer.made")}</p>
        <p className="m-0">{tf("home.footer.rights", { anio: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
