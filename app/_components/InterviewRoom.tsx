"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import InterviewResult, { DeleteSession, SessionDeleted } from "./InterviewResult";
import { interviewErrorKey, isRetryable } from "@/lib/interviews/errors";
import { interviewsApi, isOk } from "@/lib/interviews/client";
import { MAX_ANSWER_CHARS, type Interview, type InterviewScore, type InterviewStatus, type Turn } from "@/lib/interviews/types";
import { t, tf, type MessageKey } from "@/lib/messages";

type Dialogo = "pause" | "abandon" | "finish";

const TEXTOS: Record<Dialogo, { titulo: MessageKey; confirm: MessageKey; working: MessageKey; cancel: MessageKey }> = {
  pause: { titulo: "interview.pause.title", confirm: "interview.pause.confirm", working: "interview.pause.working", cancel: "interview.pause.cancel" },
  abandon: { titulo: "interview.abandon.title", confirm: "interview.abandon.confirm", working: "interview.abandon.working", cancel: "interview.abandon.cancel" },
  finish: { titulo: "interview.finish.title", confirm: "interview.finish.confirm", working: "interview.finish.working", cancel: "interview.finish.cancel" },
};

function DialogoDetalle({ tipo, borrador }: { tipo: Dialogo; borrador: boolean }) {
  if (tipo === "pause") {
    return (
      <>
        <p>{t("interview.pause.warning")}</p>
        <p>{t("interview.pause.expires")}</p>
        {borrador ? <p>{t("interview.pause.draft")}</p> : null}
      </>
    );
  }
  if (tipo === "abandon") {
    return (
      <>
        <p>{t("interview.abandon.warning")}</p>
        <p>{t("interview.abandon.keeps")}</p>
      </>
    );
  }
  return <p>{t("interview.finish.warning")}</p>;
}

const porSeq = (a: Turn, b: Turn) => a.seq - b.seq;

export default function InterviewRoom({ id }: { id: string }) {
  const [sesion, setSesion] = useState(null as Interview | null);
  const [cargaError, setCargaError] = useState(null as MessageKey | null);
  const [status, setStatus] = useState("in_progress" as InterviewStatus);
  const [turnos, setTurnos] = useState([] as Turn[]);
  const [respuesta, setRespuesta] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [pendiente, setPendiente] = useState(null as string | null);
  const [validacion, setValidacion] = useState(null as MessageKey | null);
  const [errorEnvio, setErrorEnvio] = useState(null as { key: MessageKey; retry: boolean } | null);
  const [errorAccion, setErrorAccion] = useState(null as MessageKey | null);
  const [dialogo, setDialogo] = useState(null as Dialogo | null);
  const [trabajando, setTrabajando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState(null as MessageKey | null);
  const [retomando, setRetomando] = useState(false);
  const [resultado, setResultado] = useState(undefined as InterviewScore | undefined);
  const [borrada, setBorrada] = useState(false);

  const campo = useRef(null as HTMLTextAreaElement | null);
  const disparador = useRef(null as HTMLElement | null);
  const enviando = useRef(false);
  const enDialogo = useRef(false);
  const enRetomar = useRef(false);
  const enfocar = useRef(true);

  const cargar = useCallback(async () => {
    setCargaError(null);
    const r = await interviewsApi.get(id);
    if (r.data) {
      setSesion(r.data);
      setStatus(r.data.status === "created" ? "in_progress" : r.data.status);
      setTurnos([...r.data.turns].sort(porSeq));
      enfocar.current = true;
    } else if (r.status !== 401) {
      setCargaError(r.status === 404 ? "interview.error.notFound" : "interview.room.loadError");
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conversando = Boolean(sesion) && status === "in_progress";
  useEffect(() => {
    if (conversando && !esperando && !dialogo && enfocar.current) {
      campo.current?.focus();
      enfocar.current = false;
    }
  }, [conversando, esperando, dialogo, turnos, errorEnvio]);

  async function enviar(texto: string) {
    if (enviando.current) return;
    setErrorEnvio(null);
    if (texto.trim() === "") {
      setValidacion("interview.room.validation.empty");
      campo.current?.focus();
      return;
    }
    if (texto.length > MAX_ANSWER_CHARS) {
      setValidacion("interview.room.validation.tooLong");
      campo.current?.focus();
      return;
    }
    setValidacion(null);
    enviando.current = true;
    setEsperando(true);
    setPendiente(texto.trim());
    setRespuesta("");
    const r = await interviewsApi.sendTurn(id, texto.trim());
    enviando.current = false;
    setEsperando(false);
    setPendiente(null);
    enfocar.current = true;
    if (r.data) {
      const { turn, done } = r.data;
      setTurnos((ts) => [...ts, { seq: turn.seq - 1, speaker: "candidate" as const, kind: "answer" as const, text: texto.trim() }, turn].sort(porSeq));
      if (done) setStatus("completed");
      return;
    }
    setRespuesta(texto); // nada se pierde: el texto vuelve al campo
    if (r.status !== 401) setErrorEnvio({ key: interviewErrorKey(r.status, r.error), retry: isRetryable(r.status, r.error) });
  }

  function alEnviar(ev: FormEvent) {
    ev.preventDefault();
    void enviar(respuesta);
  }

  function teclas(ev: KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      void enviar(respuesta);
    }
  }

  function abrirDialogo(d: Dialogo, el: HTMLElement) {
    disparador.current = el;
    setErrorDialogo(null);
    setDialogo(d);
  }

  function cerrarDialogo() {
    if (enDialogo.current) return;
    setDialogo(null);
    setErrorDialogo(null);
    disparador.current?.focus();
  }

  async function confirmar() {
    if (!dialogo || enDialogo.current) return;
    enDialogo.current = true;
    setTrabajando(true);
    setErrorDialogo(null);
    const d = dialogo;
    const r = d === "pause" ? await interviewsApi.pause(id) : d === "abandon" ? await interviewsApi.abandon(id) : await interviewsApi.finish(id);
    enDialogo.current = false;
    setTrabajando(false);
    if (isOk(r.status)) {
      setDialogo(null);
      if (d === "pause") setStatus("paused");
      if (d === "abandon") setStatus("abandoned");
      if (d === "finish") {
        setResultado(r.data as InterviewScore | undefined);
        setStatus("completed");
      }
    } else if (r.status !== 401) {
      setErrorDialogo(interviewErrorKey(r.status, r.error));
    }
  }

  async function retomar() {
    if (enRetomar.current) return;
    enRetomar.current = true;
    setRetomando(true);
    setErrorAccion(null);
    const r = await interviewsApi.resume(id);
    if (isOk(r.status)) await cargar();
    else if (r.status !== 401) setErrorAccion(interviewErrorKey(r.status, r.error));
    enRetomar.current = false;
    setRetomando(false);
  }

  if (cargaError) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <p className="formulario__error" role="alert">
          {t(cargaError)}
        </p>
        {cargaError === "interview.error.notFound" ? (
          <Link className="boton boton--coral" href="/interviews">
            {t("interview.result.practiceAgain")}
          </Link>
        ) : (
          <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
            {t("interview.room.retry")}
          </button>
        )}
      </main>
    );
  }
  if (!sesion) {
    return (
      <main className="pagina" aria-busy="true">
        <p role="status">{t("interview.room.loading")}</p>
      </main>
    );
  }
  if (borrada) {
    return <SessionDeleted />;
  }
  if (status === "completed") {
    return <InterviewResult id={id} initial={resultado} />;
  }
  if (status === "abandoned") {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("interview.abandoned.title")}</h1>
        <p>{t("interview.abandoned.text")}</p>
        <div className="acciones">
          <Link className="boton boton--coral" href="/interviews">
            {t("interview.result.practiceAgain")}
          </Link>
          <DeleteSession id={id} onDeleted={() => setBorrada(true)} />
        </div>
      </main>
    );
  }

  const nombre = sesion.recruiter.display_name;
  const ultimoRecruiter = [...turnos].reverse().find((x) => x.speaker === "recruiter");
  const pausada = status === "paused";
  const estado = pausada ? t("interview.room.status.paused") : esperando ? tf("interview.room.status.thinking", { name: nombre }) : t("interview.room.status.yourTurn");
  const describe = ["resp-ayuda", validacion ? "resp-error" : ""].filter(Boolean).join(" ");
  const textos = dialogo ? TEXTOS[dialogo] : null;

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{nombre}</h1>
      <p className="eslogan">
        {sesion.recruiter.role_title} · {sesion.level.name}
      </p>
      <p className="etiqueta-estado" role="status">
        {estado}
      </p>

      <div className="formulario__error" role="alert" aria-live="assertive">
        {errorAccion ? t(errorAccion) : errorEnvio ? t(errorEnvio.key) : null}
      </div>

      {pausada ? (
        <section className="grupo" aria-labelledby="pausa-titulo">
          <h2 id="pausa-titulo">{t("interview.paused.title")}</h2>
          <p>{t("interview.paused.text")}</p>
          <div className="acciones">
            <button type="button" className="boton boton--coral" onClick={() => void retomar()} disabled={retomando} aria-busy={retomando}>
              {retomando ? t("interview.room.resuming") : t("interview.room.resume")}
            </button>
            <button type="button" className="boton boton--peligro" onClick={(ev) => abrirDialogo("abandon", ev.currentTarget)}>
              {t("interview.room.abandon")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <p className="solo-lectores" aria-live="polite" aria-atomic="true">
            {ultimoRecruiter?.text ?? ""}
          </p>
          <ol className="conversacion" aria-label={t("interview.room.transcript")}>
            {turnos.map((x) => (
              <li key={x.seq} className="mensaje" data-autor={x.speaker}>
                <strong>{x.speaker === "recruiter" ? nombre : t("interview.room.you")}</strong>
                <p>{x.text}</p>
              </li>
            ))}
            {pendiente ? (
              <li className="mensaje mensaje--pendiente" data-autor="candidate">
                <strong>{t("interview.room.you")}</strong>
                <p>{pendiente}</p>
              </li>
            ) : null}
          </ol>

          <form className="formulario" onSubmit={alEnviar} noValidate>
            <div className="campo">
              <label htmlFor="resp">{t("interview.room.answerLabel")}</label>
              <textarea
                id="resp"
                ref={campo}
                rows={5}
                maxLength={MAX_ANSWER_CHARS}
                value={respuesta}
                disabled={esperando}
                aria-invalid={validacion ? true : undefined}
                aria-describedby={describe}
                onChange={(ev) => {
                  setRespuesta(ev.target.value);
                  setValidacion(null);
                }}
                onKeyDown={teclas}
              />
              <p className="campo__ayuda" id="resp-ayuda">
                {t("interview.room.answerHint")}
              </p>
              {validacion ? (
                <p className="campo__error" id="resp-error">
                  {t(validacion)}
                </p>
              ) : null}
            </div>
            <div className="acciones">
              <button className="boton boton--coral" type="submit" disabled={esperando} aria-busy={esperando}>
                {esperando ? t("interview.room.sending") : t("interview.room.send")}
              </button>
              {errorEnvio?.retry ? (
                <button type="button" className="boton boton--borde" onClick={() => void enviar(respuesta)} disabled={esperando}>
                  {t("interview.room.retrySend")}
                </button>
              ) : null}
            </div>
          </form>

          <div className="acciones">
            <button type="button" className="boton boton--borde" onClick={(ev) => abrirDialogo("pause", ev.currentTarget)} disabled={esperando}>
              {t("interview.room.pause")}
            </button>
            <button type="button" className="boton boton--borde" onClick={(ev) => abrirDialogo("finish", ev.currentTarget)} disabled={esperando}>
              {t("interview.room.finish")}
            </button>
            <button type="button" className="boton boton--peligro" onClick={(ev) => abrirDialogo("abandon", ev.currentTarget)} disabled={esperando}>
              {t("interview.room.abandon")}
            </button>
          </div>
        </>
      )}

      {dialogo && textos ? (
        <ConfirmDialog titleKey={textos.titulo} confirmKey={textos.confirm} workingKey={textos.working} cancelKey={textos.cancel} working={trabajando} error={errorDialogo} onConfirm={() => void confirmar()} onCancel={cerrarDialogo}>
          <DialogoDetalle tipo={dialogo} borrador={respuesta.trim() !== ""} />
        </ConfirmDialog>
      ) : null}
    </main>
  );
}
