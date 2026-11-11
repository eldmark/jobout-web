"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { interviewErrorText } from "@/lib/interviews/errors";
import { interviewsApi } from "@/lib/interviews/client";
import type { Level, Recruiter } from "@/lib/interviews/types";
import { goTo } from "@/lib/navigate";
import { t } from "@/lib/messages";

/** La recruiter por defecto de una práctica de oferta: Ana si existe, si no la primera. */
export function defaultRecruiter(recruiters: Recruiter[]): Recruiter | null {
  return recruiters.find((r) => r.code === "ana") ?? recruiters[0] ?? null;
}

/** El nivel más bajo que la persona puede usar hoy (disponible y desbloqueado). */
export function defaultLevel(levels: Level[]): Level | null {
  return [...levels].sort((a, b) => a.position - b.position).find((l) => l.available && l.unlocked) ?? null;
}

/**
 * «Practicar esta entrevista» (HU-31): crea una sesión con `job_offer_id` y entra a la sala. No aplica a la
 * oferta ni la empresa se entera. Sin elegir nada: Ana y el nivel más bajo disponible; quien quiera otro
 * recruiter o nivel empieza desde «Practica una entrevista».
 */
export default function PracticeOffer({ offerId }: { offerId: string }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [activa, setActiva] = useState(null as string | null);
  const enVuelo = useRef(false);

  async function practicar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    setError(null);
    setActiva(null);
    const [r, l] = await Promise.all([interviewsApi.recruiters(), interviewsApi.levels()]);
    if (!r.data || !l.data) {
      if (r.status !== 401 && l.status !== 401) setError(t("offer.practice.loadError"));
      return terminar();
    }
    const recruiter = defaultRecruiter(r.data.items);
    const level = defaultLevel(l.data.items);
    if (!recruiter) {
      setError(t("offer.practice.loadError"));
      return terminar();
    }
    if (!level) {
      setError(t("offer.practice.noLevel"));
      return terminar();
    }
    const creada = await interviewsApi.create(recruiter.id, level.id, offerId);
    if (creada.data) {
      goTo(`/interviews/${creada.data.id}`);
      return; // se queda «preparando» mientras el navegador cambia de página
    }
    if (creada.status !== 401) {
      setError(creada.error === "no_encontrado" ? t("offer.practice.notAvailable") : interviewErrorText(creada));
      if (creada.error === "sesion_en_curso") setActiva(creada.sessionId);
    }
    terminar();
  }

  function terminar() {
    enVuelo.current = false;
    setEnviando(false);
  }

  return (
    <section className="acciones" aria-label={t("offer.practice.button")}>
      <button type="button" className="boton boton--borde" disabled={enviando} aria-busy={enviando} onClick={() => void practicar()}>
        {enviando ? t("offer.practice.starting") : t("offer.practice.button")}
      </button>
      <p className="campo__ayuda">{t("offer.practice.hint")}</p>
      {error ? (
        <p role="alert" className="formulario__error">
          {error}
        </p>
      ) : null}
      {activa ? (
        <Link className="boton boton--coral" href={`/interviews/${activa}`}>
          {t("interview.start.resumeActive")}
        </Link>
      ) : null}
    </section>
  );
}
