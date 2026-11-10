"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { interviewErrorText } from "@/lib/interviews/errors";
import { interviewsApi } from "@/lib/interviews/client";
import { formatDate } from "@/lib/interviews/format";
import type { Interview, TurnKind } from "@/lib/interviews/types";
import { t, tf } from "@/lib/messages";

function porSeq(a: { seq: number }, b: { seq: number }): number {
  return a.seq - b.seq;
}

const TIPO: Record<TurnKind, () => string> = {
  question: () => t("interview.transcript.kind.question"),
  follow_up: () => t("interview.transcript.kind.follow_up"),
  closing: () => t("interview.transcript.kind.closing"),
  answer: () => t("interview.transcript.kind.answer"),
};

/** HU-15: transcripción de solo lectura de una entrevista terminada. No tiene ninguna acción que escriba. */
export default function InterviewTranscript({ id }: { id: string }) {
  const [sesion, setSesion] = useState(null as Interview | null);
  const [fallo, setFallo] = useState(null as { texto: string; reintentable: boolean } | null);

  const cargar = useCallback(async () => {
    setFallo(null);
    const r = await interviewsApi.get(id);
    if (r.data) setSesion(r.data);
    else if (r.status !== 401) {
      setFallo(r.status === 404 ? { texto: interviewErrorText(r), reintentable: false } : { texto: t("interview.transcript.loadError"), reintentable: true });
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (fallo) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.transcript.title")}</h1>
        <p className="formulario__error" role="alert">
          {fallo.texto}
        </p>
        {fallo.reintentable ? (
          <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
            {t("interview.transcript.retry")}
          </button>
        ) : (
          <Link className="boton boton--coral" href="/interviews/sessions">
            {t("interview.transcript.sessionsLink")}
          </Link>
        )}
      </main>
    );
  }
  if (!sesion) {
    return (
      <main className="pagina" aria-busy="true">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.transcript.title")}</h1>
        <p role="status">{t("interview.transcript.loading")}</p>
      </main>
    );
  }
  if (sesion.status !== "completed") {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.transcript.title")}</h1>
        <p className="aviso">{t("interview.transcript.notFinished")}</p>
        <p>
          <Link className="boton boton--coral" href={`/interviews/${id}`}>
            {t("interview.transcript.goToRoom")}
          </Link>
        </p>
      </main>
    );
  }

  const nombre = sesion.recruiter.display_name;
  const turnos = [...sesion.turns].sort(porSeq);
  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("interview.transcript.title")}</h1>
      <p className="eslogan">{tf("interview.transcript.meta", { level: sesion.level.name, recruiter: nombre, date: formatDate(sesion.created_at) })}</p>
      <p className="campo__ayuda">{t("interview.transcript.readOnly")}</p>
      {turnos.length === 0 ? (
        <p className="aviso">{t("interview.transcript.empty")}</p>
      ) : (
        <ol className="conversacion" aria-label={t("interview.transcript.messages")}>
          {turnos.map((x) => (
            <li key={x.seq} className="mensaje" data-autor={x.speaker}>
              <strong>{x.speaker === "recruiter" ? nombre : t("interview.room.you")}</strong>
              {TIPO[x.kind] ? <span className="campo__ayuda">{" · "}{TIPO[x.kind]()}</span> : null}
              <p>{x.text}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="acciones">
        <Link className="boton boton--coral" href={`/interviews/${id}`}>
          {t("interview.transcript.back")}
        </Link>
        <Link className="boton boton--borde" href="/interviews/sessions">
          {t("interview.transcript.sessionsLink")}
        </Link>
      </div>
    </main>
  );
}
