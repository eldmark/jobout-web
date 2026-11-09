"use client";

import { useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { apiFetch } from "@/lib/cv/client";
import type { ChangedHandler } from "@/lib/cv/form";
import type { CvSummary } from "@/lib/cv/types";
import { t, type MessageKey } from "@/lib/messages";

function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function CvList({ cvs, onChanged }: { cvs: CvSummary[]; onChanged: ChangedHandler }) {
  const [aBorrar, setABorrar] = useState(null as CvSummary | null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState(null as MessageKey | null);
  const [aviso, setAviso] = useState(null as MessageKey | null);
  const disparador = useRef(null as HTMLElement | null);
  const enVuelo = useRef(false);

  async function marcarPrimario(cv: CvSummary) {
    setAviso(null);
    const r = await apiFetch(`/api/cvs/${cv.id}/primary`, { method: "PUT" });
    if (r.status === 204) await onChanged();
    else if (r.status !== 401) setAviso("profile.cv.actionFailed");
  }

  function cerrar() {
    if (enVuelo.current) return;
    setABorrar(null);
    setErrorBorrado(null);
    disparador.current?.focus();
  }

  async function borrar() {
    if (!aBorrar || enVuelo.current) return;
    enVuelo.current = true;
    setBorrando(true);
    setErrorBorrado(null);
    const r = await apiFetch(`/api/cvs/${aBorrar.id}`, { method: "DELETE" });
    enVuelo.current = false;
    setBorrando(false);
    if (r.status === 204 || r.status === 404) {
      setABorrar(null);
      await onChanged();
    } else if (r.status !== 401) {
      setErrorBorrado("cv.delete.failed");
    }
  }

  return (
    <>
      {aviso ? (
        <div className="formulario__error" role="alert" aria-live="assertive">
          {t(aviso)}
        </div>
      ) : null}
      <ul className="lista">
        {cvs.map((cv) => (
          <li key={cv.id} className="tarjeta">
            <p>
              <strong>{cv.original_filename}</strong>
            </p>
            <p className="campo__ayuda">
              {t("profile.cv.version")} {cv.version} · {tamano(cv.size_bytes)} · {new Date(cv.created_at).toLocaleDateString("es")}
            </p>
            {cv.is_primary ? <span className="etiqueta">{t("profile.cv.primary")}</span> : null}
            <div className="acciones">
              <a className="boton boton--borde" href={`/api/cvs/${cv.id}/file`} download aria-label={`${t("profile.cv.download")} ${cv.original_filename}`}>
                {t("profile.cv.download")}
              </a>
              {cv.is_primary ? null : (
                <button type="button" className="boton boton--borde" aria-label={`${t("profile.cv.makePrimary")} ${cv.original_filename}`} onClick={() => void marcarPrimario(cv)}>
                  {t("profile.cv.makePrimary")}
                </button>
              )}
              <button
                type="button"
                className="boton boton--peligro"
                aria-label={`${t("profile.cv.delete")} ${cv.original_filename}`}
                onClick={(ev) => {
                  disparador.current = ev.currentTarget;
                  setABorrar(cv);
                }}
              >
                {t("profile.cv.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {aBorrar ? (
        <ConfirmDialog titleKey="cv.delete.title" confirmKey="cv.delete.confirm" workingKey="cv.delete.working" cancelKey="cv.delete.cancel" working={borrando} error={errorBorrado} onConfirm={() => void borrar()} onCancel={cerrar}>
          <p>{t("cv.delete.warning")}</p>
          <ul>
            <li>{t("cv.delete.lossFile")}</li>
            <li>{t("cv.delete.lossExtraction")}</li>
          </ul>
          <p>{t("cv.delete.keeps")}</p>
          <p>
            <strong>{t("cv.delete.irreversible")}</strong>
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
