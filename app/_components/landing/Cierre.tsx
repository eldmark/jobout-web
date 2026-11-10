import Link from "next/link";
import BackgroundPaths from "@/app/_components/ui/background-paths";
import Reveal from "@/app/_components/ui/reveal";
import { IconoFlecha } from "@/app/_components/landing/iconos";
import { t } from "@/lib/messages";

/** Última llamada a la acción: sobre índigo, el texto va en blanco (5.4:1) y el botón coral en tinta. */
export default function Cierre() {
  return (
    <section aria-labelledby="cierre-titulo" className="px-6 pb-24 sm:pb-32">
      <Reveal className="mx-auto max-w-6xl">
        <BackgroundPaths
          className="rounded-[2.5rem] bg-indigo px-6 py-20 text-center shadow-2xl shadow-indigo/25 sm:py-24"
          lineClassName="text-lavender"
          count={30}
          speed={0.6}
        >
          <div className="mx-auto max-w-2xl">
            <h2 id="cierre-titulo" className="font-display text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              {t("home.cta.title")}
            </h2>
            <p className="mt-5 text-lg text-white">{t("home.cta.body")}</p>
            <Link
              href="/sign-up"
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-4 text-base font-bold text-ink no-underline shadow-lg shadow-ink/25 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              {t("home.cta.button")}
              <IconoFlecha className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mx-auto mt-8 max-w-md text-sm text-white">{t("home.cta.privacy")}</p>
          </div>
        </BackgroundPaths>
      </Reveal>
    </section>
  );
}
