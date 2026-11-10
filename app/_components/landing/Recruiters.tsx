import Reveal from "@/app/_components/ui/reveal";
import Titular from "@/app/_components/landing/Titular";
import { cn } from "@/lib/cn";
import { t, type MessageKey } from "@/lib/messages";

/** Cada recruiter con su color de avatar; el texto sobre coral y menta va en tinta. */
const RECRUITERS = [
  { clave: "ana", avatar: "bg-indigo text-white" },
  { clave: "martin", avatar: "bg-ink text-white ring-1 ring-white/20" },
  { clave: "laura", avatar: "bg-mint text-ink" },
  { clave: "carlos", avatar: "bg-coral text-ink" },
  { clave: "sofia", avatar: "bg-lavender text-indigo" },
] as const;

const k = (clave: string, campo: string) => `home.recruiters.${clave}.${campo}` as MessageKey;

export default function Recruiters() {
  return (
    <section
      id="recruiters"
      aria-labelledby="recruiters-titulo"
      className="scroll-mt-20 bg-lavender/45 px-6 py-24 sm:py-32 dark:bg-white/[0.03]"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Titular
            id="recruiters-titulo"
            antetitulo={t("home.recruiters.eyebrow")}
            titulo={t("home.recruiters.title")}
            bajada={t("home.recruiters.lead")}
          />
        </Reveal>
        <ul className="mt-16 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-5">
          {RECRUITERS.map(({ clave, avatar }, i) => {
            const nombre = t(k(clave, "name"));
            return (
              <li key={clave}>
                <Reveal delay={i * 0.08} className="h-full">
                  <article className="group flex h-full flex-col rounded-3xl border border-ink/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo/10 dark:border-white/10 dark:bg-ink dark:hover:border-lavender/30">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-14 items-center justify-center rounded-2xl font-display text-2xl font-bold transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3",
                        avatar,
                      )}
                    >
                      {nombre.charAt(0)}
                    </span>
                    <h3 className="mt-5 font-display text-xl font-bold text-ink dark:text-white">{nombre}</h3>
                    <p className="mt-1 text-sm font-bold text-indigo dark:text-coral">{t(k(clave, "role"))}</p>
                    <p className="mt-3 text-sm text-ink/70 dark:text-lavender/75">{t(k(clave, "personality"))}</p>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
