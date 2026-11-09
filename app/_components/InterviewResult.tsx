"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { interviewErrorKey } from "@/lib/interviews/errors";
import { interviewsApi } from "@/lib/interviews/client";
import type { InterviewScore } from "@/lib/interviews/types";
import { t, type MessageKey } from "@/lib/messages";

/** Borrar la sesión: confirmación que dice qué se pierde y que el progreso acumulado no cambia. */
export function DeleteSession({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState(null as MessageKey | null);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLButtonElement | null);

  function cerrar() {
    if (enVuelo.current) return;
    setAbierto(false);
    setError(null);
    disparador.current?.focus();
  }

  async function borrar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setBorrando(true);
    setError(null);
    const r = await interviewsApi.remove(id);
    enVuelo.current = false;
    setBorrando(false);
    if (r.status === 204 || r.status === 404) onDeleted();
    else if (r.status !== 401) setError(interviewErrorKey(r.status, r.error));
  }

  return (
    <>
      <button type="button" ref={disparador} className="boton boton--peligro" onClick={() => setAbierto(true)}>
        {t("interview.result.delete")}
      </button>
      {abierto ? (
        <ConfirmDialog
          titleKey="interview.delete.title"
          confirmKey="interview.delete.confirm"
          workingKey="interview.delete.working"
          cancelKey="interview.delete.cancel"
          working={borrando}
          error={error}
          onConfirm={() => void borrar()}
          onCancel={cerrar}
        >
          <p>{t("interview.delete.warning")}</p>
          <ul>
            <li>{t("interview.delete.lossTranscript")}</li>
            <li>{t("interview.delete.lossScore")}</li>
          </ul>
          <p>{t("interview.delete.keeps")}</p>
          <p>
            <strong>{t("interview.delete.irreversible")}</strong>
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function SessionDeleted() {
  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("interview.deleted.title")}</h1>
      <p>{t("interview.deleted.text")}</p>
      <div className="acciones">
        <Link className="boton boton--coral" href="/interviews">
          {t("interview.result.practiceAgain")}
        </Link>
        <Link className="boton boton--borde" href="/interviews/progress">
          {t("interview.result.progressLink")}
        </Link>
      </div>
    </main>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="dato">
      <dt>{etiqueta}</dt>
      <dd>
        <span className="dato__cifra">{valor}</span> {t("interview.result.outOf")}
      </dd>
    </div>
  );
}

export default function InterviewResult({ id, initial }: { id: string; initial?: InterviewScore }) {
  const [score, setScore] = useState((initial ?? null) as InterviewScore | null);
  const [fallo, setFallo] = useState(false);
  const [borrada, setBorrada] = useState(false);

  const cargar = useCallback(async () => {
    setFallo(false);
    const r = await interviewsApi.score(id);
    if (r.data) setScore(r.data);
    else if (r.status !== 401) setFallo(true);
  }, [id]);

  useEffect(() => {
    if (!initial) void cargar();
  }, [initial, cargar]);

  if (borrada) {
    return <SessionDeleted />;
  }
  if (fallo) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <p className="formulario__error" role="alert">
          {t("interview.result.loadError")}
        </p>
        <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
          {t("interview.result.retry")}
        </button>
      </main>
    );
  }
  if (!score) {
    return (
      <main className="pagina" aria-busy="true">
        <p role="status">{t("interview.result.loading")}</p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("interview.result.title")}</h1>
      <dl className="datos">
        <Dato etiqueta={t("interview.result.score")} valor={score.score} />
        <Dato etiqueta={t("interview.result.clarity")} valor={score.clarity} />
        {score.confidence !== null && score.confidence !== undefined ? <Dato etiqueta={t("interview.result.confidence")} valor={score.confidence} /> : null}
      </dl>

      <section className="grupo" aria-labelledby="res-desglose">
        <h2 id="res-desglose">{t("interview.result.breakdown")}</h2>
        <ul className="lista" aria-labelledby="res-desglose">
          {score.breakdown.map((c) => (
            <li key={c.criterion} className="tarjeta">
              <p>
                <strong>{c.label}</strong> <span className="dato__cifra">{c.score}</span> {t("interview.result.outOf")}
              </p>
              <p className="campo__ayuda">
                <strong>{t("interview.result.why")}:</strong> {c.why}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grupo" aria-labelledby="res-mejoras">
        <h2 id="res-mejoras">{t("interview.result.improvements")}</h2>
        <ul aria-labelledby="res-mejoras">
          {score.improvements.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <p className="campo__ayuda">
        {t("interview.result.rubric")}: {score.rubric_version}
      </p>
      <div className="acciones">
        <Link className="boton boton--coral" href="/interviews">
          {t("interview.result.practiceAgain")}
        </Link>
        <Link className="boton boton--borde" href="/interviews/progress">
          {t("interview.result.progressLink")}
        </Link>
        <DeleteSession id={id} onDeleted={() => setBorrada(true)} />
      </div>
    </main>
  );
}
