import Reveal from "@/app/_components/ui/reveal";
import Titular from "@/app/_components/landing/Titular";
import { IconoConversacion, IconoGrafica, IconoPersonas } from "@/app/_components/landing/iconos";
import { t, type MessageKey } from "@/lib/messages";

const PASOS = [
  { titulo: "home.how.step1.title", cuerpo: "home.how.step1.body", Icono: IconoPersonas },
  { titulo: "home.how.step2.title", cuerpo: "home.how.step2.body", Icono: IconoConversacion },
  { titulo: "home.how.step3.title", cuerpo: "home.how.step3.body", Icono: IconoGrafica },
] satisfies { titulo: MessageKey; cuerpo: MessageKey; Icono: unknown }[];

export default function ComoFunciona() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-20 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Titular id="como-funciona-titulo" antetitulo={t("home.how.eyebrow")} titulo={t("home.how.title")} bajada={t("home.how.lead")} />
        </Reveal>
        <ol className="mt-16 grid list-none gap-6 p-0 md:grid-cols-3">
          {PASOS.map(({ titulo, cuerpo, Icono }, i) => (
            <li key={titulo}>
              <Reveal delay={i * 0.12} className="h-full">
                <article className="group relative h-full overflow-hidden rounded-3xl border border-ink/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo/30 hover:shadow-xl hover:shadow-indigo/10 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-lavender/30">
                  <span
                    aria-hidden="true"
                    className="absolute top-8 right-8 font-display text-5xl leading-none font-bold text-indigo/15 transition group-hover:text-indigo/30 dark:text-lavender/15 dark:group-hover:text-lavender/30"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-lavender text-indigo dark:bg-indigo/25 dark:text-lavender">
                    <Icono className="size-6" />
                  </span>
                  <h3 className="mt-6 font-display text-xl font-bold text-ink dark:text-white">{t(titulo)}</h3>
                  <p className="mt-3 text-ink/70 dark:text-lavender/75">{t(cuerpo)}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
