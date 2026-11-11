"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import CountUp from "./CountUp";
import { Ring, Sparkline } from "./charts";
import { Icono } from "./icons";
import { Kpi } from "./Tiles";
import { candidateView, SIGUIENTE, weekdayLabel, type CandidateInput } from "@/lib/dashboard/view";
import { t, tf } from "@/lib/messages";

const noSubscribe = () => () => {};
/** La zona horaria de la persona: los días de la racha son los suyos. En el servidor, UTC. */
const zonaCliente = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const zonaServidor = () => "UTC";

export interface CandidateStatsProps extends CandidateInput {
  /** Instante del servidor (ISO): servidor y navegador coinciden en «hoy» al hidratar. */
  nowIso: string;
}

export default function CandidateStats({ nowIso, ...input }: CandidateStatsProps) {
  const tz = useSyncExternalStore(noSubscribe, zonaCliente, zonaServidor);
  const v = candidateView(input, new Date(nowIso), tz);
  const s = v.summary;
  const { applications } = input;
  let i = 0;

  return (
    <section className="panel-seccion" aria-labelledby="panel-progreso">
      <h2 id="panel-progreso">{t("dashboard.stats.title")}</h2>
      {v.sample ? <p className="aviso">{t("dashboard.sample.note")}</p> : null}
      <ul className="panel-lista">
        {v.showPractice ? (
          <>
            <Kpi id="kpi-racha" color="coral" icon="flame" label={t("dashboard.streak.title")} index={i++} wide sample={v.sample}>
              <div className="racha__cuerpo">
                <span className="llama">
                  <Icono name="flame" />
                </span>
                <div>
                  <p className="kpi__valor">
                    <CountUp value={s.streak} /> <small>{s.streak === 1 ? t("dashboard.streak.unitOne") : t("dashboard.streak.unit")}</small>
                  </p>
                  <p className="kpi__nota">{s.streak === 0 ? t("dashboard.streak.none") : t(v.streakHint)}</p>
                </div>
              </div>
              <ol className="racha__dias" aria-label={t("dashboard.streak.week")}>
                {s.week.map((d, n) => (
                  <li key={d.key} className="racha__dia" data-hecho={d.done} data-hoy={d.today} style={{ "--i": n } as CSSProperties}>
                    <span className="racha__punto" aria-hidden="true">
                      {d.done ? <Icono name="check" /> : null}
                    </span>
                    <span aria-hidden="true">{weekdayLabel(d.key, "narrow")}</span>
                    <span className="solo-lectores">{tf(d.done ? "dashboard.streak.dayDone" : "dashboard.streak.dayMissed", { day: weekdayLabel(d.key, "long") })}</span>
                  </li>
                ))}
              </ol>
            </Kpi>
            <Kpi id="kpi-promedio" color="indigo" icon="chart" label={t("dashboard.stats.average")} index={i++} sample={v.sample}>
              <div className="kpi__cuerpo">
                <p className="kpi__valor">
                  <CountUp value={s.average ?? 0} /> <small>{t("dashboard.stats.outOf")}</small>
                </p>
                <Ring percent={s.average ?? 0} />
              </div>
            </Kpi>
            <Kpi id="kpi-mejor" color="mint" icon="star" label={t("dashboard.stats.best")} index={i++} sample={v.sample}>
              <p className="kpi__valor">
                <CountUp value={s.best ?? 0} /> <small>{t("dashboard.stats.outOf")}</small>
              </p>
              <Sparkline values={s.series} />
              <span className="solo-lectores">{tf("dashboard.stats.series", { values: s.series.join(", ") })}</span>
            </Kpi>
            <Kpi id="kpi-practicas" color="indigo" icon="target" label={t("dashboard.stats.practices")} index={i++} sample={v.sample}>
              <p className="kpi__valor">
                <CountUp value={s.count} />
              </p>
            </Kpi>
          </>
        ) : null}
        {applications !== null ? (
          <Kpi id="kpi-aplicaciones" color="mint" icon="send" label={t("dashboard.stats.applications")} index={i++}>
            <p className="kpi__valor">
              <CountUp value={applications} />
            </p>
          </Kpi>
        ) : null}
        {v.showCompletion ? (
          <Kpi id="kpi-pasos" color="coral" icon="list" label={t("dashboard.completion.title")} index={i++} wide>
            <div className="kpi__cuerpo">
              <div>
                <p className="kpi__valor">
                  {v.completion.percent}
                  <small> %</small>
                  <span className="solo-lectores">{tf("dashboard.completion.percent", { n: v.completion.percent })}</span>
                </p>
                <p className="kpi__nota">{tf("dashboard.completion.steps", { done: v.completion.done, total: v.completion.total })}</p>
                {v.nextStep ? (
                  <Link className="boton boton--borde" href={SIGUIENTE[v.nextStep].href}>
                    {t(SIGUIENTE[v.nextStep].key)}
                  </Link>
                ) : (
                  <p className="kpi__nota">{t("dashboard.completion.done")}</p>
                )}
              </div>
              <Ring percent={v.completion.percent} />
            </div>
          </Kpi>
        ) : null}
      </ul>
    </section>
  );
}
