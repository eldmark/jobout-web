"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import ExternalApplications from "./ExternalApplications";
import { formatDate } from "@/lib/interviews/format";
import { offersApi } from "@/lib/offers/client";
import { applicationStatusLabel, placeOf, revealedCompany } from "@/lib/offers/format";
import { useCursorList } from "@/lib/offers/paging";
import { canWithdraw, SHARED_FIELDS, type Application, type ApplicationStatus, type ApplicationSummary, type SharedField } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

const PAGINA = 20;
const PESTANAS = ["platform", "external"] as const;
type Pestana = (typeof PESTANAS)[number];
const ETIQUETA: Record<Pestana, MessageKey> = { platform: "applications.tabs.platform", external: "applications.tabs.external" };

type Detalle = { estado: "loading" } | { estado: "error" } | { estado: "ready"; datos: Application };

/** Solo los nombres del conjunto cerrado (un nombre desconocido no se pinta). */
function compartibles(lista: string[]): SharedField[] {
  return lista.filter((f): f is SharedField => (SHARED_FIELDS as readonly string[]).includes(f));
}

/** AP7: del historial solo se pinta `{status, at}`; nunca una nota, un motivo ni quién decidió. */
function DetalleAplicacion({ id, detalle, onRetry }: { id: string; detalle: Detalle; onRetry: () => void }) {
  if (detalle.estado === "loading") return <p className="campo__ayuda">{t("applications.details.loading")}</p>;
  if (detalle.estado === "error") {
    return (
      <>
        <p className="formulario__error" role="alert">
          {t("applications.details.error")}
        </p>
        <button type="button" className="boton boton--borde" onClick={onRetry}>
          {t("applications.details.retry")}
        </button>
      </>
    );
  }
  const compartido = compartibles(detalle.datos.shared_fields);
  return (
    <>
      <h3 id={`historial-${id}`}>{t("applications.history")}</h3>
      <ol aria-labelledby={`historial-${id}`}>
        {detalle.datos.history.map((h, i) => (
          <li key={`${h.status}-${i}`}>{tf("applications.history.entry", { status: applicationStatusLabel(h.status), date: formatDate(h.at) })}</li>
        ))}
      </ol>
      <h3 id={`compartido-${id}`}>{t("applications.shared")}</h3>
      <ul aria-labelledby={`compartido-${id}`}>
        {compartido.map((f) => (
          <li key={f}>{t(`apply.field.${f}`)}</li>
        ))}
      </ul>
    </>
  );
}

/** Mis aplicaciones en JobOut: estado, fecha, historial, qué compartí y retirar con confirmación (FC3). */
function PlatformApplications() {
  const pagina = useCallback((cursor?: string) => offersApi.applications({ limit: PAGINA, cursor }), []);
  const { items, setItems, phase, hasMore, loadingMore, moreError, reload, more, firstNew } = useCursorList(pagina);
  const [detalles, setDetalles] = useState({} as Record<string, Detalle>);
  const [aRetirar, setARetirar] = useState(null as ApplicationSummary | null);
  const [retirando, setRetirando] = useState(false);
  const [errorRetiro, setErrorRetiro] = useState(null as string | null);
  const [aviso, setAviso] = useState(null as string | null);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);
  const focoTras = useRef(null as string | null);
  const lista = useRef(null as HTMLUListElement | null);

  useEffect(() => {
    const desde = firstNew.current;
    if (desde !== null) {
      firstNew.current = null;
      lista.current?.children[desde]?.querySelector<HTMLElement>("a, button")?.focus();
    }
    // «Retirar» desaparece al retirar: el foco pasa a «Ver detalle» de esa misma aplicación.
    if (focoTras.current) {
      document.getElementById(`ver-${focoTras.current}`)?.focus();
      focoTras.current = null;
    }
  }, [items, firstNew]);

  const cargarDetalle = useCallback(async (id: string) => {
    setDetalles((d) => ({ ...d, [id]: { estado: "loading" } }));
    const r = await offersApi.application(id);
    setDetalles((d) => {
      if (!d[id]) return d; // se plegó mientras cargaba
      if (r.data) return { ...d, [id]: { estado: "ready", datos: r.data } };
      return r.status === 401 ? d : { ...d, [id]: { estado: "error" } };
    });
  }, []);

  function alternar(id: string) {
    if (detalles[id]) {
      setDetalles((d) => {
        const resto = { ...d };
        delete resto[id];
        return resto;
      });
      return;
    }
    void cargarDetalle(id);
  }

  function cambiarEstado(id: string, status: ApplicationStatus) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  function cerrar() {
    if (enVuelo.current) return;
    setARetirar(null);
    setErrorRetiro(null);
    disparador.current?.focus();
  }

  async function retirar() {
    if (!aRetirar || enVuelo.current) return;
    const id = aRetirar.id;
    enVuelo.current = true;
    setRetirando(true);
    setErrorRetiro(null);
    const r = await offersApi.withdraw(id);
    enVuelo.current = false;
    setRetirando(false);
    const estado: ApplicationStatus | null = r.status === 204 ? "withdrawn" : r.status === 409 ? r.currentStatus : null;
    if (estado) {
      focoTras.current = id;
      cambiarEstado(id, estado);
      setARetirar(null);
      setAviso(r.status === 204 ? t("applications.withdraw.done") : tf("applications.withdraw.notAllowed", { status: applicationStatusLabel(estado) }));
      if (detalles[id]) void cargarDetalle(id);
    } else if (r.status !== 401) {
      setErrorRetiro(r.status === 0 || r.status >= 500 ? t("applications.withdraw.failed") : t("offers.error.state"));
    }
  }

  if (phase === "error") {
    return (
      <>
        <p className="formulario__error" role="alert">
          {t("applications.loadError")}
        </p>
        <button type="button" className="boton boton--borde" onClick={() => void reload()}>
          {t("applications.retry")}
        </button>
      </>
    );
  }
  if (phase === "loading") {
    return (
      <p role="status" aria-busy="true">
        {t("applications.loading")}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <>
        <p className="aviso">{t("applications.empty")}</p>
        <p>
          <Link className="boton boton--coral" href="/offers">
            {t("applications.cta")}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="solo-lectores" role="status">
        {items.length === 1 ? t("applications.shownOne") : tf("applications.shown", { n: items.length })}
      </p>
      {aviso ? (
        <p className="formulario__aviso" role="status">
          {aviso}
        </p>
      ) : null}
      <ul className="lista" ref={lista} aria-label={t("applications.listLabel")}>
        {items.map((a) => {
          const empresa = revealedCompany(a.offer);
          const lugar = placeOf(a.offer);
          const publicada = a.offer.status === "published";
          const detalle = detalles[a.id];
          return (
            <li key={a.id} className="tarjeta">
              {/* Una oferta pausada o cerrada daría 404: su título no enlaza. */}
              <h2 className="tarjeta__titulo">{publicada ? <Link href={`/offers/${a.offer.id}`}>{a.offer.title}</Link> : a.offer.title}</h2>
              {/* AP9: la empresa de una confidencial aparece solo si la API la devuelve (al preseleccionar). */}
              <p className="tarjeta__empresa">{empresa ? empresa.name : t("offers.confidential")}</p>
              {lugar ? <p className="campo__ayuda">{lugar}</p> : null}
              <p className="etiqueta-estado">
                {t("applications.statusLabel")} {applicationStatusLabel(a.status)}
              </p>
              <p className="campo__ayuda">{tf("applications.appliedOn", { date: formatDate(a.applied_at) })}</p>
              {publicada ? null : <p className="campo__ayuda">{t("applications.offerClosed")}</p>}
              <div className="acciones acciones--juntas">
                <button
                  type="button"
                  id={`ver-${a.id}`}
                  className="boton boton--borde"
                  aria-expanded={Boolean(detalle)}
                  aria-controls={`detalle-${a.id}`}
                  aria-label={tf("applications.actionLabel", { action: t("applications.details.show"), title: a.offer.title })}
                  onClick={() => alternar(a.id)}
                >
                  {t("applications.details.show")}
                </button>
                {canWithdraw(a.status) ? (
                  <button
                    type="button"
                    className="boton boton--peligro"
                    aria-label={tf("applications.actionLabel", { action: t("applications.withdraw"), title: a.offer.title })}
                    onClick={(ev) => {
                      disparador.current = ev.currentTarget;
                      setAviso(null);
                      setARetirar(a);
                    }}
                  >
                    {t("applications.withdraw")}
                  </button>
                ) : null}
              </div>
              <div id={`detalle-${a.id}`} className="detalle" hidden={!detalle}>
                {detalle ? <DetalleAplicacion id={a.id} detalle={detalle} onRetry={() => void cargarDetalle(a.id)} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {moreError ? (
        <p className="formulario__error" role="alert">
          {t("applications.moreError")}
        </p>
      ) : null}
      {hasMore ? (
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
            {loadingMore ? t("applications.moreLoading") : t("applications.more")}
          </button>
        </div>
      ) : null}
      {aRetirar ? (
        <ConfirmDialog
          titleKey="applications.withdraw.title"
          confirmKey="applications.withdraw.confirm"
          workingKey="applications.withdraw.working"
          cancelKey="applications.withdraw.cancel"
          working={retirando}
          errorText={errorRetiro}
          onConfirm={() => void retirar()}
          onCancel={cerrar}
        >
          <p>
            <strong>{aRetirar.offer.title}</strong>
          </p>
          <p>{t("applications.withdraw.warning")}</p>
          <p>{t("applications.withdraw.stopsSharing")}</p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

/** «Mis aplicaciones»: las de JobOut y, en su pestaña, el registro privado de las externas (HU-32). */
export default function ApplicationsView() {
  const [pestana, setPestana] = useState("platform" as Pestana);
  // La pestaña de externas se monta al elegirla por primera vez y se conserva al volver.
  const [externaVista, setExternaVista] = useState(false);
  const botones = useRef([] as (HTMLButtonElement | null)[]);

  function elegir(p: Pestana) {
    setPestana(p);
    if (p === "external") setExternaVista(true);
  }

  /** Pestañas con flechas, Inicio y Fin (patrón de pestañas de WAI-ARIA, con activación automática). */
  function teclas(ev: KeyboardEvent<HTMLButtonElement>, i: number) {
    const destino = { ArrowRight: (i + 1) % PESTANAS.length, ArrowLeft: (i - 1 + PESTANAS.length) % PESTANAS.length, Home: 0, End: PESTANAS.length - 1 }[ev.key];
    if (destino === undefined) return;
    ev.preventDefault();
    elegir(PESTANAS[destino]);
    botones.current[destino]?.focus();
  }

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("applications.title")}</h1>
      <p className="enlaces">
        <Link href="/offers">{t("applications.toOffers")}</Link>
        <Link href="/dashboard">{t("offers.back")}</Link>
      </p>
      <div role="tablist" aria-label={t("applications.tabs.label")} className="pestanas">
        {PESTANAS.map((p, i) => (
          <button
            key={p}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`pestana-${p}`}
            className="pestanas__pestana"
            aria-selected={pestana === p}
            aria-controls={`panel-${p}`}
            tabIndex={pestana === p ? 0 : -1}
            onClick={() => elegir(p)}
            onKeyDown={(ev) => teclas(ev, i)}
          >
            {t(ETIQUETA[p])}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-platform" aria-labelledby="pestana-platform" hidden={pestana !== "platform"}>
        <PlatformApplications />
      </div>
      <div role="tabpanel" id="panel-external" aria-labelledby="pestana-external" hidden={pestana !== "external"}>
        {externaVista ? <ExternalApplications /> : null}
      </div>
    </main>
  );
}
