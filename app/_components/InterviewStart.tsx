"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { interviewErrorKey } from "@/lib/interviews/errors";
import { interviewsApi } from "@/lib/interviews/client";
import type { Level, Recruiter } from "@/lib/interviews/types";
import { goTo } from "@/lib/navigate";
import { t, tf, type MessageKey } from "@/lib/messages";

type Datos = { recruiters: Recruiter[]; levels: Level[] };

/** Motivo por el que un nivel no se puede elegir; null si se puede. */
export function levelReason(level: Level, levels: Level[]): string | null {
  if (!level.available) return t("interview.level.unavailable");
  if (level.unlocked) return null;
  const previo = levels.find((l) => l.position === level.position - 1);
  if (previo && level.min_score_to_unlock != null) {
    return tf("interview.level.lockedScore", { min: level.min_score_to_unlock, previous: previo.name });
  }
  return t("interview.level.lockedGeneric");
}

export default function InterviewStart() {
  const [datos, setDatos] = useState(null as Datos | null);
  const [cargaFallo, setCargaFallo] = useState(false);
  const [recruiterId, setRecruiterId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [errores, setErrores] = useState({} as { recruiter?: MessageKey; level?: MessageKey });
  const [errorGeneral, setErrorGeneral] = useState(null as MessageKey | null);
  const [activa, setActiva] = useState(null as string | null);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  const formRef = useRef(null as HTMLFormElement | null);

  const cargar = useCallback(async () => {
    setCargaFallo(false);
    setDatos(null);
    const [r, l] = await Promise.all([interviewsApi.recruiters(), interviewsApi.levels()]);
    if (r.data && l.data) setDatos({ recruiters: r.data, levels: [...l.data].sort((a, b) => a.position - b.position) });
    else if (r.status !== 401 && l.status !== 401) setCargaFallo(true);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function empezar(ev: FormEvent) {
    ev.preventDefault();
    if (enVuelo.current) return;
    setErrorGeneral(null);
    setActiva(null);
    const e: typeof errores = {};
    if (!recruiterId) e.recruiter = "interview.start.validation.recruiter";
    const elegido = datos?.levels.find((l) => l.id === levelId);
    if (!elegido || levelReason(elegido, datos!.levels)) e.level = "interview.start.validation.level";
    setErrores(e);
    const grupo = e.recruiter ? "recruiter" : e.level ? "level" : null;
    if (grupo) {
      formRef.current?.querySelector<HTMLInputElement>(`input[name="${grupo}"]:not(:disabled)`)?.focus();
      return;
    }
    enVuelo.current = true;
    setEnviando(true);
    const r = await interviewsApi.create(recruiterId, levelId);
    if (r.data) {
      goTo(`/interviews/${r.data.id}`);
      return; // se queda «enviando» mientras el navegador cambia de página
    }
    if (r.status !== 401) {
      setErrorGeneral(interviewErrorKey(r.status, r.error));
      if (r.error === "sesion_en_curso") setActiva(r.sessionId);
    }
    enVuelo.current = false;
    setEnviando(false);
  }

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("interview.start.title")}</h1>
      <p className="eslogan">{t("interview.start.intro")}</p>
      {cargaFallo ? (
        <>
          <p className="formulario__error" role="alert">
            {t("interview.start.loadError")}
          </p>
          <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
            {t("interview.start.retry")}
          </button>
        </>
      ) : !datos ? (
        <p role="status">{t("interview.start.loading")}</p>
      ) : (
        <form className="formulario" ref={formRef} onSubmit={(ev) => void empezar(ev)} noValidate>
          <div className="formulario__error" role="alert" aria-live="assertive">
            {errorGeneral ? t(errorGeneral) : null}
          </div>
          {activa ? (
            <p>
              <a className="boton boton--coral" href={`/interviews/${activa}`}>
                {t("interview.start.resumeActive")}
              </a>
            </p>
          ) : null}
          <fieldset className="opciones" aria-describedby={errores.recruiter ? "err-recruiter" : undefined} disabled={enviando}>
            <legend>{t("interview.recruiter.legend")}</legend>
            {datos.recruiters.map((r) => (
              <div className="opcion" key={r.id}>
                <input
                  type="radio"
                  id={`rec-${r.id}`}
                  name="recruiter"
                  value={r.id}
                  checked={recruiterId === r.id}
                  aria-labelledby={`rec-${r.id}-nombre`}
                  aria-describedby={`rec-${r.id}-detalle`}
                  onChange={() => {
                    setRecruiterId(r.id);
                    setErrores((x) => ({ ...x, recruiter: undefined }));
                  }}
                />
                <label htmlFor={`rec-${r.id}`}>
                  <strong id={`rec-${r.id}-nombre`}>{r.display_name}</strong>
                  <span id={`rec-${r.id}-detalle`} className="campo__ayuda">
                    {r.role_title}. {r.personality}
                  </span>
                </label>
              </div>
            ))}
            {errores.recruiter ? (
              <p className="campo__error" id="err-recruiter">
                {t(errores.recruiter)}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="opciones" aria-describedby={errores.level ? "err-level" : undefined} disabled={enviando}>
            <legend>{t("interview.level.legend")}</legend>
            {datos.levels.map((l) => {
              const motivo = levelReason(l, datos.levels);
              return (
                <div className="opcion" key={l.id} data-bloqueado={motivo ? "true" : undefined}>
                  <input
                    type="radio"
                    id={`lvl-${l.id}`}
                    name="level"
                    value={l.id}
                    checked={levelId === l.id}
                    disabled={Boolean(motivo)}
                    aria-describedby={motivo ? `lvl-${l.id}-motivo` : undefined}
                    onChange={() => {
                      if (motivo) return; // defensa: un nivel bloqueado nunca se elige
                      setLevelId(l.id);
                      setErrores((x) => ({ ...x, level: undefined }));
                    }}
                  />
                  <label htmlFor={`lvl-${l.id}`}>
                    <strong>{l.name}</strong>
                  </label>
                  {motivo ? (
                    <p className="campo__ayuda" id={`lvl-${l.id}-motivo`}>
                      {motivo}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {errores.level ? (
              <p className="campo__error" id="err-level">
                {t(errores.level)}
              </p>
            ) : null}
          </fieldset>
          <button className="boton boton--coral" type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? t("interview.start.submitting") : t("interview.start.submit")}
          </button>
          <p className="formulario__pie">
            <a href="/interviews/progress">{t("interview.start.progressLink")}</a>
          </p>
        </form>
      )}
    </main>
  );
}
