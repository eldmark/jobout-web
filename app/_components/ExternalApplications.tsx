"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { offersApi } from "@/lib/offers/client";
import { offerErrorText } from "@/lib/offers/errors";
import { externalStatusLabel, formatDay } from "@/lib/offers/format";
import { fiveYearsBefore, todayLocal, toExternalInput, validateExternal, type ExternalErrors, type ExternalField, type ExternalForm } from "@/lib/offers/external";
import { useCursorList } from "@/lib/offers/paging";
import { EXTERNAL_STATUSES, type External } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

const PAGINA = 20;
const VACIO: ExternalForm = { company_name: "", position: "", applied_on: "", status: "", notes: "" };
/** Orden de los campos: el foco va al primero con error. */
const CAMPOS: ExternalField[] = ["company_name", "position", "applied_on", "status", "notes"];
const ETIQUETA: Record<ExternalField, MessageKey> = {
  company_name: "external.field.company",
  position: "external.field.position",
  applied_on: "external.field.appliedOn",
  status: "external.field.status",
  notes: "external.field.notes",
};

type Edicion = { modo: "new" } | { modo: "edit"; id: string };

/**
 * HU-32 (decisión 6): registro manual y privado de aplicaciones hechas fuera de JobOut. Nadie más lo
 * ve y no pasa por el consentimiento ni por la máquina de estados.
 */
export default function ExternalApplications() {
  const pagina = useCallback((cursor?: string) => offersApi.externals({ limit: PAGINA, cursor }), []);
  const { items, setItems, phase, hasMore, loadingMore, moreError, reload, more, firstNew } = useCursorList(pagina);
  const [edicion, setEdicion] = useState(null as Edicion | null);
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({} as ExternalErrors);
  const [errorServidor, setErrorServidor] = useState(null as string | null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null as MessageKey | null);
  const [aBorrar, setABorrar] = useState(null as External | null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState(null as MessageKey | null);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);
  const anotar = useRef(null as HTMLButtonElement | null);
  const lista = useRef(null as HTMLUListElement | null);
  const hoy = todayLocal();

  // Al abrir el formulario, el foco va al primer campo.
  useEffect(() => {
    if (edicion) document.getElementById("externa-company_name")?.focus();
  }, [edicion]);

  useEffect(() => {
    const desde = firstNew.current;
    if (desde === null) return;
    firstNew.current = null;
    lista.current?.children[desde]?.querySelector<HTMLElement>("button")?.focus();
  }, [items, firstNew]);

  function abrir(e: Edicion, inicial: ExternalForm, boton: HTMLElement) {
    disparador.current = boton;
    setEdicion(e);
    setValores(inicial);
    setErrores({});
    setErrorServidor(null);
    setAviso(null);
  }

  function cerrarFormulario(foco: HTMLElement | null) {
    setEdicion(null);
    setErrores({});
    setErrorServidor(null);
    foco?.focus();
  }

  async function guardar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current || !edicion) return;
    const errs = validateExternal(valores, todayLocal());
    setErrores(errs);
    setErrorServidor(null);
    const primero = CAMPOS.find((c) => errs[c]);
    if (primero) {
      document.getElementById(`externa-${primero}`)?.focus();
      return;
    }
    const input = toExternalInput(valores);
    enVuelo.current = true;
    setGuardando(true);
    const r = edicion.modo === "edit" ? await offersApi.updateExternal(edicion.id, input) : await offersApi.createExternal(input);
    enVuelo.current = false;
    setGuardando(false);
    if (r.status === 201 && r.data) {
      const nuevo = r.data;
      setItems((prev) => [nuevo, ...prev.filter((x) => x.id !== nuevo.id)]);
    } else if (r.status === 204 && edicion.modo === "edit") {
      const id = edicion.id;
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...input } : x)));
    } else {
      if (r.status !== 401) setErrorServidor(offerErrorText(r));
      return;
    }
    setAviso("external.saved");
    cerrarFormulario(edicion.modo === "edit" ? disparador.current : anotar.current);
  }

  async function borrar() {
    if (!aBorrar || enVuelo.current) return;
    const id = aBorrar.id;
    enVuelo.current = true;
    setBorrando(true);
    setErrorBorrado(null);
    const r = await offersApi.removeExternal(id);
    enVuelo.current = false;
    setBorrando(false);
    if (r.status === 204 || r.status === 404) {
      setItems((prev) => prev.filter((x) => x.id !== id));
      setABorrar(null);
      setAviso("external.deleted");
      if (edicion?.modo === "edit" && edicion.id === id) setEdicion(null);
      anotar.current?.focus();
    } else if (r.status !== 401) {
      setErrorBorrado("external.delete.failed");
    }
  }

  function cancelarBorrado() {
    if (enVuelo.current) return;
    setABorrar(null);
    setErrorBorrado(null);
    disparador.current?.focus();
  }

  const hayErrores = CAMPOS.some((c) => errores[c]);
  const describir = (c: ExternalField, ayuda?: string) => [ayuda, errores[c] ? `externa-${c}-error` : undefined].filter(Boolean).join(" ") || undefined;
  const error = (c: ExternalField) => {
    const clave = errores[c];
    return clave ? (
      <p id={`externa-${c}-error`} className="campo__error">
        {t(clave)}
      </p>
    ) : null;
  };
  const texto = (c: "company_name" | "position") => {
    return (
      <div className="campo">
      <label htmlFor={`externa-${c}`}>{t(ETIQUETA[c])}</label>
      <input id={`externa-${c}`} type="text" autoComplete="off" value={valores[c]} aria-invalid={Boolean(errores[c])} aria-describedby={describir(c)} onChange={(ev) => setValores((v) => ({ ...v, [c]: ev.target.value }))} />
      {error(c)}
      </div>
    );
  };

  return (
    <div className="grupo">
      <p className="aviso">
        {t("external.intro")}
      </p>
      {aviso ? (
        <p className="formulario__aviso" role="status">
          {t(aviso)}
        </p>
      ) : null}
      <p>
        <button type="button" ref={anotar} className="boton boton--coral" onClick={(ev) => abrir({ modo: "new" }, VACIO, ev.currentTarget)}>
          {t("external.add")}
        </button>
      </p>

      {edicion ? (
        <form method="post" className="formulario tarjeta" aria-labelledby="externa-titulo" noValidate onSubmit={(ev) => void guardar(ev)}>
          <h2 id="externa-titulo">{t(edicion.modo === "edit" ? "external.form.edit" : "external.form.new")}</h2>
          {hayErrores ? (
            <p className="formulario__error" role="alert">
              {t("external.error.summary")}
            </p>
          ) : null}
          {errorServidor ? (
            <p className="formulario__error" role="alert">
              {errorServidor}
            </p>
          ) : null}
          {texto("company_name")}
          {texto("position")}
          <div className="campo">
            <label htmlFor="externa-applied_on">{t(ETIQUETA.applied_on)}</label>
            <input
              id="externa-applied_on"
              type="date"
              min={fiveYearsBefore(hoy)}
              max={hoy}
              value={valores.applied_on}
              aria-invalid={Boolean(errores.applied_on)}
              aria-describedby={describir("applied_on")}
              onChange={(ev) => setValores((v) => ({ ...v, applied_on: ev.target.value }))}
            />
            {error("applied_on")}
          </div>
          <div className="campo">
            <label htmlFor="externa-status">{t(ETIQUETA.status)}</label>
            <select id="externa-status" value={valores.status} aria-invalid={Boolean(errores.status)} aria-describedby={describir("status")} onChange={(ev) => setValores((v) => ({ ...v, status: ev.target.value }))}>
              <option value="">{t("external.field.statusNone")}</option>
              {EXTERNAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {externalStatusLabel(s)}
                </option>
              ))}
            </select>
            {error("status")}
          </div>
          <div className="campo">
            <label htmlFor="externa-notes">{t(ETIQUETA.notes)}</label>
            <textarea
              id="externa-notes"
              rows={3}
              value={valores.notes}
              aria-invalid={Boolean(errores.notes)}
              aria-describedby={describir("notes", "externa-notes-ayuda")}
              onChange={(ev) => setValores((v) => ({ ...v, notes: ev.target.value }))}
            />
            <p id="externa-notes-ayuda" className="campo__ayuda">
              {t("external.field.notesHelp")}
            </p>
            {error("notes")}
          </div>
          <div className="acciones acciones--juntas">
            <button type="submit" className="boton boton--coral" disabled={guardando} aria-busy={guardando}>
              {guardando ? t("external.saving") : t("external.save")}
            </button>
            <button type="button" className="boton boton--borde" disabled={guardando} onClick={() => cerrarFormulario(disparador.current)}>
              {t("external.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {phase === "error" ? (
        <>
          <p className="formulario__error" role="alert">
            {t("external.loadError")}
          </p>
          <button type="button" className="boton boton--borde" onClick={() => void reload()}>
            {t("external.retry")}
          </button>
        </>
      ) : null}
      {phase === "loading" ? (
        <p role="status" aria-busy="true">
          {t("external.loading")}
        </p>
      ) : null}
      {phase === "ready" && items.length === 0 ? <p className="aviso">{t("external.empty")}</p> : null}
      {phase === "ready" && items.length > 0 ? (
        <>
          <ul className="lista" ref={lista} aria-label={t("external.listLabel")}>
            {items.map((e) => {
              const etiqueta = (accion: MessageKey) => tf("external.actionLabel", { action: t(accion), position: e.position, company: e.company_name });
              return (
                <li key={e.id} className="tarjeta">
                  <h2 className="tarjeta__titulo">{e.position}</h2>
                  <p className="tarjeta__empresa">{e.company_name}</p>
                  <p className="etiqueta-estado">{externalStatusLabel(e.status)}</p>
                  <p className="campo__ayuda">{tf("external.appliedOn", { date: formatDay(e.applied_on) })}</p>
                  {e.notes ? <p className="texto-libre">{e.notes}</p> : null}
                  <div className="acciones acciones--juntas">
                    <button
                      type="button"
                      className="boton boton--borde"
                      aria-label={etiqueta("external.edit")}
                      onClick={(ev) => abrir({ modo: "edit", id: e.id }, { company_name: e.company_name, position: e.position, applied_on: e.applied_on, status: e.status, notes: e.notes ?? "" }, ev.currentTarget)}
                    >
                      {t("external.edit")}
                    </button>
                    <button
                      type="button"
                      className="boton boton--peligro"
                      aria-label={etiqueta("external.delete")}
                      onClick={(ev) => {
                        disparador.current = ev.currentTarget;
                        setAviso(null);
                        setABorrar(e);
                      }}
                    >
                      {t("external.delete")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {moreError ? (
            <p className="formulario__error" role="alert">
              {t("external.moreError")}
            </p>
          ) : null}
          {hasMore ? (
            <div className="acciones">
              <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
                {loadingMore ? t("external.moreLoading") : t("external.more")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {aBorrar ? (
        <ConfirmDialog
          titleKey="external.delete.title"
          confirmKey="external.delete.confirm"
          workingKey="external.delete.working"
          cancelKey="external.delete.cancel"
          working={borrando}
          error={errorBorrado}
          onConfirm={() => void borrar()}
          onCancel={cancelarBorrado}
        >
          <p>
            <strong>{aBorrar.position}</strong>
            {" · "}
            {aBorrar.company_name}
          </p>
          <p>{t("external.delete.warning")}</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
