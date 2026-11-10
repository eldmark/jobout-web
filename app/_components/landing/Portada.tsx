import Link from "next/link";
import BackgroundPaths from "@/app/_components/ui/background-paths";
import TextRotate from "@/app/_components/ui/text-rotate";
import { IconoCodigo, IconoFlecha } from "@/app/_components/landing/iconos";
import { t, type MessageKey } from "@/lib/messages";

/** Qué se practica. Cada tipo es el estilo de un recruiter, que se presentan más abajo. */
const TIPOS: MessageKey[] = [
  "home.hero.kind.technical",
  "home.hero.kind.hr",
  "home.hero.kind.behavioral",
  "home.hero.kind.english",
  "home.hero.kind.startup",
];

/** El primer pantallazo: fondo de líneas en movimiento, el eslogan y las dos llamadas. */
export default function Portada() {
  return (
    <BackgroundPaths
      className="flex min-h-[calc(100svh-4rem)] items-center bg-[radial-gradient(ellipse_at_top,var(--color-lavender),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-indigo)_28%,transparent),transparent_65%)]"
      lineClassName="text-indigo dark:text-lavender"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-indigo/20 bg-white/70 px-4 py-1.5 text-sm font-semibold text-indigo backdrop-blur dark:border-lavender/20 dark:bg-ink/60 dark:text-lavender">
          <IconoCodigo className="size-4 text-indigo dark:text-coral" />
          {t("home.badge")}
        </p>

        <h1 className="mt-7 font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance text-ink sm:text-6xl md:text-7xl dark:text-white">
          {t("brand.slogan")}
        </h1>

        <p className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-display text-2xl font-bold text-ink sm:text-3xl dark:text-white">
          {t("home.hero.practice")}
          <TextRotate
            texts={TIPOS.map((k) => t(k))}
            rotationInterval={2200}
            staggerDuration={0.025}
            staggerFrom="last"
            mainClassName="overflow-hidden rounded-xl bg-coral px-3 py-1 text-ink justify-center"
            splitLevelClassName="overflow-hidden pb-0.5"
          />
        </p>

        <p className="mt-6 max-w-2xl text-lg text-pretty text-ink/70 sm:text-xl dark:text-lavender/80">{t("home.hero.lead")}</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2 rounded-full bg-coral px-7 py-3.5 text-base font-bold text-ink no-underline shadow-lg shadow-coral/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/35"
          >
            {t("home.signUp")}
            <IconoFlecha className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-full border border-ink/15 bg-white/70 px-7 py-3.5 text-base font-bold text-ink no-underline backdrop-blur transition hover:-translate-y-0.5 hover:border-indigo hover:text-indigo dark:border-white/20 dark:bg-ink/50 dark:text-white dark:hover:border-lavender dark:hover:text-lavender"
          >
            {t("home.signIn")}
          </Link>
        </div>

        <p className="mt-6 text-sm text-ink/60 dark:text-lavender/60">{t("home.notice")}</p>
      </div>
    </BackgroundPaths>
  );
}
