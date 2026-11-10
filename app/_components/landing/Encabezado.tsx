import Link from "next/link";
import Logo from "@/app/_components/brand/Logo";
import { t } from "@/lib/messages";

/** Barra superior fija, translúcida, con el logo, las anclas de la portada y el ingreso. */
export default function Encabezado() {
  const anclas = [
    { href: "#como-funciona", texto: t("home.nav.how") },
    { href: "#recruiters", texto: t("home.nav.recruiters") },
    { href: "#niveles", texto: t("home.nav.levels") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/75 backdrop-blur-md dark:border-white/10 dark:bg-ink/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Logo />
        <nav aria-label={t("home.nav.label")} className="flex items-center gap-1 text-sm font-semibold">
          {anclas.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="hidden rounded-full px-3 py-2 text-ink/70 no-underline transition-colors hover:bg-lavender hover:text-indigo md:inline-block dark:text-lavender/80 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {a.texto}
            </a>
          ))}
          <Link
            href="/sign-in"
            className="ml-2 rounded-full border border-ink/15 px-4 py-2 text-ink no-underline transition-colors hover:border-indigo hover:text-indigo dark:border-white/20 dark:text-white dark:hover:border-lavender"
          >
            {t("home.nav.signIn")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
