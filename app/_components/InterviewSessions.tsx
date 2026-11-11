"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { interviewsApi } from "@/lib/interviews/client";
import { formatDate } from "@/lib/interviews/format";
import type { InterviewStatus, InterviewSummary } from "@/lib/interviews/types";
import { t, tf } from "@/lib/messages";

const PAGINA = 20;

const ESTADO: Record<InterviewStatus, () => string> = {
  created: () => t("interview.sessions.status.in_progress"),
  in_progress: () => t("interview.sessions.status.in_progress"),
  paused: () => t("interview.sessions.status.paused"),
  completed: () => t("interview.sessions.status.completed"),
  abandoned: () => t("interview.sessions.status.abandoned"),
};

type Accion = { href: string; texto: string };

function acciones(s: InterviewSummary): Accion[] {
  if (s.status === "completed") {
    return [
      { href: `/interviews/${s.id}`, texto: t("interview.sessions.viewResult") },
      { href: `/interviews/${s.id}/transcript`, texto: t("interview.sessions.viewTranscript") },
    ];
  }
  if (s.status === "abandoned") return [];
  return [{ href: `/interviews/${s.id}`, texto: t("interview.sessions.resume") }];
}

/** Todas tus entrevistas, de la más reciente a la más antigua, paginadas por cursor. */
export default function InterviewSessions() {
  const [filas, setFilas] = useState([] as InterviewSummary[]);
  const [cursor, setCursor] = useState(null as string | null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [falloMas, setFalloMas] = useState(false);
  const enVuelo = useRef(false);
  const tabla = useRef(null as HTMLTableElement | null);
  const primeraNueva = useRef(null as number | null);

  const cargar = useCallback(async () => {
    setFallo(false);
    setCargando(true);
    const r = await interviewsApi.list({ limit: PAGINA });
    if (r.data) {
      setFilas(r.data.items);
      setCursor(r.data.next_cursor ?? null);
      setCargando(false);
    } else if (r.status !== 401) {
      setFallo(true);
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarMas() {
    if (enVuelo.current || !cursor) return;
    enVuelo.current = true;
    setCargandoMas(true);
    setFalloMas(false);
    const r = await interviewsApi.list({ limit: PAGINA, cursor });
    enVuelo.current = false;
    setCargandoMas(false);
    if (r.data) {
      const nuevas = r.data.items.filter((n) => !filas.some((f) => f.id === n.id));
      primeraNueva.current = filas.length;
      setFilas([...filas, ...nuevas]);
      setCursor(r.data.next_cursor ?? null);
    } else if (r.status !== 401) {
      setFalloMas(true);
    }
  }

  // El botón desaparece o se deshabilita al cargar: el foco pasa a la primera fila nueva para no perderlo.
  useEffect(() => {
    const desde = primeraNueva.current;
    if (desde === null) return;
    primeraNueva.current = null;
    tabla.current?.querySelectorAll("tbody tr")[desde]?.querySelector<HTMLElement>("a")?.focus();
  }, [filas]);

  if (fallo) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.sessions.title")}</h1>
        <p className="formulario__error" role="alert">
          {t("interview.sessions.loadError")}
        </p>
        <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
          {t("interview.sessions.retry")}
        </button>
      </main>
    );
  }
  if (cargando) {
    return (
      <main className="pagina" aria-busy="true">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.sessions.title")}</h1>
        <p role="status">{t("interview.sessions.loading")}</p>
      </main>
    );
  }
  if (filas.length === 0) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.sessions.title")}</h1>
        <p className="aviso">{t("interview.sessions.empty")}</p>
        <p>
          <Link className="boton boton--coral" href="/interviews">
            {t("interview.sessions.cta")}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina pagina--ancha">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("interview.sessions.title")}</h1>
      <p className="solo-lectores" role="status">
        {filas.length === 1 ? t("interview.sessions.shownOne") : tf("interview.sessions.shown", { n: filas.length })}
      </p>
      <div className="tabla-scroll" role="region" tabIndex={0} aria-label={t("interview.sessions.title")}>
        <table className="tabla" ref={tabla} aria-label={t("interview.sessions.title")}>
          <thead>
            <tr>
              <th scope="col">{t("interview.sessions.col.date")}</th>
              <th scope="col">{t("interview.sessions.col.level")}</th>
              <th scope="col">{t("interview.sessions.col.recruiter")}</th>
              <th scope="col">{t("interview.sessions.col.status")}</th>
              <th scope="col">{t("interview.sessions.col.score")}</th>
              <th scope="col">{t("interview.sessions.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((s) => {
              const fecha = formatDate(s.created_at);
              const enlaces = acciones(s);
              return (
                <tr key={s.id}>
                  <td>{fecha}</td>
                  <td>{s.level.name}</td>
                  <td>{s.recruiter.display_name}</td>
                  <td>{ESTADO[s.status]()}</td>
                  <td>{s.score === null || s.score === undefined ? t("interview.sessions.noScore") : s.score}</td>
                  <td>
                    {/* BUG-005: sin contenedor, los enlaces salían pegados («Ver resultadoVer transcripción»). */}
                    {enlaces.length > 0 ? (
                      <div className="tabla__acciones">
                        {enlaces.map((a) => (
                          <Link key={a.href} href={a.href} aria-label={tf("interview.sessions.actionLabel", { action: a.texto, level: s.level.name, recruiter: s.recruiter.display_name, date: fecha })}>
                            {a.texto}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {falloMas ? (
        <p className="formulario__error" role="alert">
          {t("interview.sessions.moreError")}
        </p>
      ) : null}
      <div className="acciones">
        {cursor ? (
          <button type="button" className="boton boton--borde" onClick={() => void cargarMas()} disabled={cargandoMas} aria-busy={cargandoMas}>
            {cargandoMas ? t("interview.sessions.moreLoading") : t("interview.sessions.more")}
          </button>
        ) : null}
        <Link className="boton boton--coral" href="/interviews">
          {t("interview.sessions.cta")}
        </Link>
      </div>
    </main>
  );
}
