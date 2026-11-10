import Reveal from "@/app/_components/ui/reveal";
import Titular from "@/app/_components/landing/Titular";
import { IconoCandado, IconoCheck } from "@/app/_components/landing/iconos";
import { cn } from "@/lib/cn";
import { t, tf, type MessageKey } from "@/lib/messages";

/** Los cinco niveles de la Fase 3. Amazon, Google y McKinsey existen pero todavía no se pueden practicar. */
const NIVELES = [
  { clave: "junior", disponible: true },
  { clave: "startup", disponible: true },
  { clave: "amazon", disponible: false },
  { clave: "google", disponible: false },
  { clave: "mckinsey", disponible: false },
] as const;

const k = (clave: string, campo: string) => `home.levels.${clave}.${campo}` as MessageKey;

export default function Niveles() {
  return (
    <section id="niveles" aria-labelledby="niveles-titulo" className="scroll-mt-20 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Titular id="niveles-titulo" antetitulo={t("home.levels.eyebrow")} titulo={t("home.levels.title")} bajada={t("home.levels.lead")} />
        </Reveal>
        {/* El orden lo dice la etiqueta «Nivel N» de cada tarjeta: una línea por detrás se cruzaba
            con las tarjetas punteadas, que son transparentes. */}
        <ol aria-label={t("home.levels.title")} className="mt-16 grid list-none gap-4 p-0 md:grid-cols-5">
          {NIVELES.map(({ clave, disponible }, i) => (
            <li key={clave} className="relative">
              <Reveal delay={i * 0.1} className="h-full">
                <div
                  className={cn(
                    "flex h-full flex-col items-center rounded-3xl border p-6 text-center transition duration-300",
                    disponible
                      ? "border-ink/10 bg-white shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-mint/15 dark:border-white/10 dark:bg-ink"
                      : "border-dashed border-ink/15 bg-transparent dark:border-white/15",
                  )}
                >
                  <span
                    className={cn(
                      "mb-4 text-xs font-bold tracking-[0.18em] uppercase",
                      disponible ? "text-indigo dark:text-coral" : "text-ink/50 dark:text-lavender/50",
                    )}
                  >
                    {tf("home.levels.step", { n: i + 1 })}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative flex size-14 items-center justify-center rounded-full",
                      disponible ? "bg-mint text-ink" : "bg-ink/5 text-ink/40 dark:bg-white/5 dark:text-lavender/40",
                    )}
                  >
                    {disponible ? <IconoCheck className="size-6" /> : <IconoCandado className="size-6" />}
                  </span>
                  <h3 className={cn("mt-4 font-display text-lg font-bold", disponible ? "text-ink dark:text-white" : "text-ink/50 dark:text-lavender/50")}>
                    {t(k(clave, "name"))}
                  </h3>
                  <p className={cn("mt-1 mb-4 text-sm", disponible ? "text-ink/70 dark:text-lavender/75" : "text-ink/50 dark:text-lavender/50")}>
                    {t(k(clave, "detail"))}
                  </p>
                  {disponible ? null : (
                    <span className="mt-auto rounded-full bg-lavender px-3 py-1 text-xs font-bold text-indigo dark:bg-white/10 dark:text-lavender">
                      {t("home.levels.soon")}
                    </span>
                  )}
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
