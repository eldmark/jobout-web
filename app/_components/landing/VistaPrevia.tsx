import ContainerScroll from "@/app/_components/ui/container-scroll";
import Titular from "@/app/_components/landing/Titular";
import { cn } from "@/lib/cn";
import { t, type MessageKey } from "@/lib/messages";

/** Ejemplo de desglose: la suma de los puntos es el score, como en el producto. */
const CRITERIOS: { nombre: MessageKey; puntos: number; maximo: number }[] = [
  { nombre: "home.preview.criteria.specificity", puntos: 16, maximo: 20 },
  { nombre: "home.preview.criteria.structure", puntos: 11, maximo: 15 },
  { nombre: "home.preview.criteria.relevance", puntos: 19, maximo: 25 },
  { nombre: "home.preview.criteria.clarity", puntos: 21, maximo: 25 },
  { nombre: "home.preview.criteria.depth", puntos: 9, maximo: 15 },
];
const SCORE = CRITERIOS.reduce((suma, c) => suma + c.puntos, 0);

function Burbuja({ deRecruiter, children, etiqueta }: { deRecruiter: boolean; children: React.ReactNode; etiqueta?: string }) {
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-1", deRecruiter ? "self-start" : "self-end items-end")}>
      {etiqueta ? <span className="text-xs font-bold text-indigo dark:text-coral">{etiqueta}</span> : null}
      <p
        className={cn(
          "m-0 rounded-2xl px-4 py-3 text-sm leading-relaxed",
          deRecruiter ? "rounded-tl-md bg-lavender text-ink dark:bg-white/10 dark:text-lavender" : "rounded-tr-md bg-indigo text-white",
        )}
      >
        {children}
      </p>
    </div>
  );
}

/** La sala de entrevista en miniatura, dentro de la tarjeta que se endereza al bajar. */
export default function VistaPrevia() {
  return (
    <section aria-labelledby="vista-previa-titulo" className="overflow-hidden px-2">
      <ContainerScroll
        titleComponent={
          <Titular
            id="vista-previa-titulo"
            antetitulo={t("home.preview.eyebrow")}
            titulo={t("home.preview.title")}
            bajada={t("home.preview.lead")}
            className="mb-16"
          />
        }
      >
        <figure aria-labelledby="vista-previa-descripcion" className="m-0 h-full">
          <figcaption id="vista-previa-descripcion" className="sr-only">
            {t("home.preview.caption")}
          </figcaption>
          <div aria-hidden="true" className="grid h-full md:grid-cols-[1.35fr_1fr]">
            <div className="flex min-h-0 flex-col border-ink/10 md:border-r dark:border-white/10">
              <div className="flex items-center gap-3 border-b border-ink/10 px-5 py-4 dark:border-white/10">
                <span className="flex size-10 items-center justify-center rounded-xl bg-indigo font-display font-bold text-white">
                  {t("home.recruiters.ana.name").charAt(0)}
                </span>
                <span className="text-sm font-bold text-ink dark:text-white">{t("home.preview.recruiter")}</span>
                <span className="ml-auto size-2.5 rounded-full bg-mint" />
              </div>
              <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-4 py-4 md:px-5 md:py-5">
                <Burbuja deRecruiter>{t("home.preview.question")}</Burbuja>
                <Burbuja deRecruiter={false}>{t("home.preview.answerVague")}</Burbuja>
                <Burbuja deRecruiter etiqueta={t("home.preview.followUpTag")}>
                  {t("home.preview.followUp")}
                </Burbuja>
                <Burbuja deRecruiter={false}>{t("home.preview.answerConcrete")}</Burbuja>
              </div>
              <div className="border-t border-ink/10 px-5 py-4 dark:border-white/10">
                <div className="hidden rounded-xl border border-ink/15 px-4 py-3 text-sm text-ink/50 md:block dark:border-white/15 dark:text-lavender/50">
                  {t("home.preview.typing")}
                </div>
                {/* En pantallas angostas no cabe la columna del resultado: va como una ficha. */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-lavender px-4 py-3 text-sm text-ink md:hidden dark:bg-white/10 dark:text-lavender">
                  <span className="inline-flex items-center gap-2 font-bold">
                    <span className="size-2 rounded-full bg-mint" />
                    {t("home.preview.feedback")}
                  </span>
                  <span className="font-display text-lg font-bold text-indigo dark:text-white">
                    {SCORE} <span className="text-xs font-semibold text-ink/60 dark:text-lavender/60">{t("home.preview.outOf")}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden flex-col gap-5 bg-lavender/40 p-6 md:flex dark:bg-white/[0.03]">
              <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-ink dark:text-white">
                <span className="size-2 rounded-full bg-mint" />
                {t("home.preview.feedback")}
              </p>
              <div>
                <p className="m-0 text-xs font-bold tracking-wider text-ink/60 uppercase dark:text-lavender/60">{t("home.preview.score")}</p>
                <p className="m-0 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-bold text-indigo dark:text-white">{SCORE}</span>
                  <span className="text-ink/60 dark:text-lavender/60">{t("home.preview.outOf")}</span>
                </p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {CRITERIOS.map((c) => (
                  <li key={c.nombre} className="text-sm">
                    <div className="flex justify-between text-ink dark:text-lavender">
                      <span>{t(c.nombre)}</span>
                      <span className="font-bold tabular-nums">
                        {c.puntos} / {c.maximo}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
                      <div className="h-full rounded-full bg-mint" style={{ width: `${(c.puntos / c.maximo) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-auto rounded-2xl bg-white p-4 text-sm text-ink shadow-sm dark:bg-ink dark:text-lavender">
                <p className="m-0 font-bold">{t("home.preview.improve")}</p>
                <p className="m-0 mt-1 text-ink/70 dark:text-lavender/75">{t("home.preview.improvement")}</p>
              </div>
            </div>
          </div>
        </figure>
      </ContainerScroll>
    </section>
  );
}
