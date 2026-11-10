"use client";

import { useRef, useState } from "react";
import ProfileForm from "./ProfileForm";
import { apiFetch, errorKey, loadCatalogs, uploadCv } from "@/lib/cv/client";
import { CV_ACCEPT, MAX_CV_BYTES, isAllowedCvType } from "@/lib/cv/limits";
import { EMPTY_CATALOGS, emptyForm, fromProposal, type Catalogs } from "@/lib/cv/form";
import type { UploadedCv } from "@/lib/cv/types";
import { goTo } from "@/lib/navigate";
import { t, type MessageKey } from "@/lib/messages";

type Etapa = { tipo: "elegir" } | { tipo: "revisar"; cv: UploadedCv; catalogs: Catalogs } | { tipo: "fallo"; cv: UploadedCv; catalogs: Catalogs; manual: boolean };

async function cargarCatalogos(): Promise<Catalogs> {
  const c = await loadCatalogs(["skills", "languages"]);
  return { ...EMPTY_CATALOGS, skills: c.skills ?? [], languages: c.languages ?? [] };
}

const INICIAL = { tipo: "elegir" } as Etapa;

export default function CvFlow() {
  const [etapa, setEtapa] = useState(INICIAL);
  const [archivo, setArchivo] = useState(null as File | null);
  const [nombre, setNombre] = useState(null as string | null);
  const entrada = useRef(null as HTMLInputElement | null);
  const [error, setError] = useState(null as MessageKey | null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const enVuelo = useRef(false);

  function elegir(ev: { target: HTMLInputElement }) {
    const f = ev.target.files?.[0] ?? null;
    setError(null);
    setArchivo(null);
    setNombre(f ? f.name : null);
    if (!f) return;
    if (f.size > MAX_CV_BYTES) return setError("cv.error.tooBig");
    if (!isAllowedCvType(f.name, f.type)) return setError("cv.error.badType");
    setArchivo(f);
  }

  async function subir() {
    if (enVuelo.current) return;
    if (!archivo) return setError("cv.error.noFile");
    enVuelo.current = true;
    setSubiendo(true);
    setProgreso(0);
    setError(null);
    const r = await uploadCv(archivo, setProgreso);
    if (r.status === 201 && r.data) {
      const cv = r.data as UploadedCv;
      const catalogs = await cargarCatalogos();
      setEtapa(cv.extraction?.status === "ready" ? { tipo: "revisar", cv, catalogs } : { tipo: "fallo", cv, catalogs, manual: false });
    } else if (r.status !== 401) {
      setError(errorKey(r.status, r.error));
    }
    enVuelo.current = false;
    setSubiendo(false);
  }

  async function confirmar(cvId: string, payload: unknown) {
    const r = await apiFetch(`/api/cvs/${cvId}/extraction/confirm`, { method: "POST", json: payload });
    if (r.status === 204) {
      goTo("/profile");
      return { done: true as const };
    }
    if (r.status === 401) return { done: true as const };
    return { error: errorKey(r.status, r.error) };
  }

  if (etapa.tipo === "elegir") {
    return (
      <main className="pagina">
        <h1>{t("cv.title")}</h1>
        <p className="eslogan">{t("cv.intro")}</p>
        <form
          method="post"
          className="formulario"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            void subir();
          }}
        >
          <div className="campo">
            <label htmlFor="cv-archivo">{t("cv.upload.fileLabel")}</label>
            <div className="archivo">
              <input ref={entrada} className="archivo__input" id="cv-archivo" type="file" accept={CV_ACCEPT} onChange={elegir} disabled={subiendo} aria-describedby="cv-archivo-ayuda cv-archivo-estado" />
              <span className="boton boton--borde archivo__boton" aria-hidden="true" onClick={() => entrada.current?.click()}>
                {t("cv.upload.choose")}
              </span>
              <span className="archivo__estado" id="cv-archivo-estado">
                {nombre ?? t("cv.upload.noFile")}
              </span>
            </div>
            <p className="campo__ayuda" id="cv-archivo-ayuda">
              {t("cv.upload.hint")}
            </p>
          </div>
          {subiendo ? <progress aria-label={t("cv.upload.progress")} value={progreso} max={100} /> : null}
          {error ? (
            <div className="formulario__error" role="alert" aria-live="assertive">
              {t(error)}
            </div>
          ) : null}
          <div className="acciones">
            <button type="submit" className="boton boton--coral" disabled={!archivo || subiendo}>
              {subiendo ? t("cv.upload.uploading") : t("cv.upload.submit")}
            </button>
            <a className="boton boton--borde" href="/profile">
              {t("cv.upload.manual")}
            </a>
          </div>
        </form>
      </main>
    );
  }

  if (etapa.tipo === "fallo" && !etapa.manual) {
    const motivo = etapa.cv.extraction.reason ?? "ilegible";
    return (
      <main className="pagina">
        <h1>{t("review.failed.title")}</h1>
        <p>{t(`review.failed.${motivo}`)}</p>
        <div className="acciones">
          <button type="button" className="boton boton--coral" onClick={() => setEtapa({ ...etapa, manual: true })}>
            {t("review.failed.manual")}
          </button>
        </div>
      </main>
    );
  }

  const inicial = etapa.tipo === "revisar" ? fromProposal(etapa.cv.extraction.proposal) : emptyForm();
  const cvId = etapa.cv.id;
  return (
    <main className="pagina">
      <h1 id="review-titulo">{t("review.title")}</h1>
      <p className="eslogan">{t("review.intro")}</p>
      <ProfileForm initial={inicial} catalogs={etapa.catalogs} mode="confirm" submitLabel="review.confirm" busyLabel="review.confirming" onSubmit={(p) => confirmar(cvId, p)} />
    </main>
  );
}
