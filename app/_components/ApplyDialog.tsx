"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { offersApi } from "@/lib/offers/client";
import { consentBody, fieldAvailability } from "@/lib/offers/consent";
import { offerErrorText } from "@/lib/offers/errors";
import { MANDATORY_FIELDS, SHARED_FIELDS, type Application, type SharedField } from "@/lib/offers/types";
import type { ProfileData } from "@/lib/cv/types";
import { t, type MessageKey } from "@/lib/messages";

/** Qué decir cuando la persona no tiene ese dato en su perfil (nombre y correo son de la cuenta: siempre existen). */
const FALTA: Partial<Record<SharedField, MessageKey>> = {
  skills: "apply.missing.skills",
  experience: "apply.missing.experience",
  experience_descriptions: "apply.missing.experience_descriptions",
  languages: "apply.missing.languages",
  education: "apply.missing.education",
  profile_description: "apply.missing.profile_description",
  phone: "apply.missing.phone",
};

interface Props {
  offerId: string;
  confidential: boolean;
  onCancel: () => void;
  onApplied: (a: Application) => void;
}

/**
 * FC2 (HU-52, decisión 2): dice exactamente qué verá la empresa. Cada campo del conjunto cerrado con
 * su casilla; los tres mínimos marcados y bloqueados; el resto, contacto incluido, sin marcar. Nada se
 * envía hasta marcar «Acepto compartir esto», y el consentimiento nunca se asume.
 */
export default function ApplyDialog({ offerId, confidential, onCancel, onApplied }: Props) {
  const [marcados, setMarcados] = useState(new Set<SharedField>());
  const [acepto, setAcepto] = useState(false);
  const [perfil, setPerfil] = useState(null as ProfileData | null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null as string | null);
  const enVuelo = useRef(false);
  const dialogo = useRef(null as HTMLDivElement | null);

  // El perfil se lee solo aquí, para avisar qué datos faltan; no se guarda ni se muestra.
  useEffect(() => {
    let vivo = true;
    void offersApi.profile().then((r) => {
      if (vivo && r.data) setPerfil(r.data);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    dialogo.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
  }, []);

  const disponible = fieldAvailability(perfil);

  function alternar(f: SharedField) {
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(f)) s.delete(f);
      else s.add(f);
      return s;
    });
  }

  async function enviar() {
    const cuerpo = consentBody(marcados, acepto);
    if (!cuerpo || enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    setError(null);
    const r = await offersApi.apply(offerId, cuerpo);
    enVuelo.current = false;
    setEnviando(false);
    if (r.data) {
      onApplied(r.data);
      return;
    }
    if (r.status === 401) return;
    // Un 404 aquí es que la oferta se cerró o se pausó mientras la persona la miraba (AP5).
    setError(r.status === 404 ? t("offer.gone") : offerErrorText(r));
  }

  /** Escape cierra; Tab queda atrapado dentro del diálogo, casillas incluidas. */
  function teclas(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      if (!enVuelo.current) onCancel();
      return;
    }
    if (ev.key !== "Tab" || !dialogo.current) return;
    const items = (Array.from(dialogo.current.querySelectorAll("input, button")) as HTMLInputElement[]).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (ev.shiftKey && (document.activeElement === primero || !dialogo.current.contains(document.activeElement))) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (document.activeElement === ultimo || !dialogo.current.contains(document.activeElement))) {
      ev.preventDefault();
      primero.focus();
    }
  }

  return (
    <div className="velo">
      <div ref={dialogo} className="dialogo dialogo--ancho" role="dialog" aria-modal="true" aria-labelledby="aplicar-titulo" aria-describedby="aplicar-intro" onKeyDown={teclas}>
        <h2 id="aplicar-titulo">{t("apply.title")}</h2>
        <p id="aplicar-intro">{t("apply.intro")}</p>
        <fieldset className="opciones">
          <legend>{t("apply.fieldsLegend")}</legend>
          {SHARED_FIELDS.map((f) => {
            const fijo = MANDATORY_FIELDS.includes(f);
            const falta = disponible[f] === false ? FALTA[f] : undefined;
            const ayudas = [fijo ? `aplicar-${f}-fijo` : "", falta ? `aplicar-${f}-falta` : ""].filter(Boolean).join(" ");
            return (
              <div className="casilla" key={f}>
                <input
                  type="checkbox"
                  id={`aplicar-${f}`}
                  checked={fijo || marcados.has(f)}
                  disabled={fijo || enviando}
                  onChange={() => alternar(f)}
                  aria-describedby={ayudas || undefined}
                />
                <label htmlFor={`aplicar-${f}`}>{t(`apply.field.${f}`)}</label>
                {fijo ? (
                  <p id={`aplicar-${f}-fijo`} className="campo__ayuda">
                    {t("apply.mandatory")}
                  </p>
                ) : null}
                {falta ? (
                  <p id={`aplicar-${f}-falta`} className="campo__ayuda">
                    {t(falta)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>
        <p className="campo__ayuda">{t("apply.contactHint")}</p>
        <ul className="avisos">
          <li>{t("apply.live")}</li>
          <li>{t("apply.never")}</li>
          {confidential ? <li>{t("apply.confidential")}</li> : null}
          <li>
            <strong>{t("apply.final")}</strong>
          </li>
        </ul>
        <div className="casilla casilla--acepto">
          <input type="checkbox" id="aplicar-acepto" checked={acepto} disabled={enviando} onChange={(ev) => setAcepto(ev.target.checked)} />
          <label htmlFor="aplicar-acepto">{t("apply.accept")}</label>
        </div>
        {error ? (
          <div className="formulario__error" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}
        <div className="dialogo__acciones">
          <button type="button" className="boton boton--borde" onClick={onCancel} disabled={enviando}>
            {t("apply.cancel")}
          </button>
          <button type="button" className="boton boton--coral" onClick={() => void enviar()} disabled={!acepto || enviando}>
            {enviando ? t("apply.working") : t("apply.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
