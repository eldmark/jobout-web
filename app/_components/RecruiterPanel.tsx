"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import CompanyGateNotice from "./CompanyGateNotice";
import { companyApi } from "@/lib/company/client";
import { companyErrorText } from "@/lib/company/errors";
import { availabilityKey, nextStatuses, type CompanyGate } from "@/lib/company/rules";
import { NOTE_MAX, PANEL_SORTS, type OfferDetail, type PanelApplication, type PanelRow, type PanelSort, type RecruiterTarget, type SharedApplicant } from "@/lib/company/types";
import { countChars } from "@/lib/interviews/types";
import { formatDate } from "@/lib/interviews/format";
import { applicationStatusLabel, formatDay, formatWait } from "@/lib/offers/format";
import { useCursorList } from "@/lib/offers/paging";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

const PAGINA = 20;
const ORDEN: Record<PanelSort, MessageKey> = { recent: "offers.filters.sort.recent", oldest: "offers.filters.sort.oldest" };

interface Filtros {
  status: ApplicationStatus | "";
  favorite: "" | "true" | "false";
  sort: PanelSort;
}
const SIN_FILTROS: Filtros = { status: "", favorite: "", sort: "recent" };

/** El nombre visible, o el texto de la entrada anónima (PA10). */
function nombreDe(r: Pick<PanelRow, "availability"> & { applicant: { display_name?: string } | null }): string {
  const anonima = availabilityKey(r.availability);
  if (anonima) return t(anonima);
  return r.applicant?.display_name ?? "";
}

/** PA2/PA3: solo las claves que la persona compartió; lo que no viaja no se pinta. Todo como texto. */
function Compartido({ a }: { a: SharedApplicant }) {
  const contacto = "email" in a || "phone" in a;
  const educacion = a.education ? [a.education.academic_level?.name, a.education.profession?.name, a.education.job_hierarchy?.name].filter(Boolean).join(" · ") : "";
  return (
    <>
      {a.skills ? (
        <>
          <h3>{t("panel.shared.skills")}</h3>
          <ul>
            {a.skills.map((s) => (
              <li key={s.skill.id}>
                {s.skill.name}
                {s.level ? `${" · "}${t(`form.level.${s.level}`)}` : null}
                {s.years_of_experience !== null && s.years_of_experience !== undefined ? `${" · "}${tf("panel.skill.years", { n: s.years_of_experience })}` : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {a.experience ? (
        <>
          <h3>{t("panel.shared.experience")}</h3>
          <ul>
            {a.experience.map((e, i) => (
              <li key={`${e.company}-${i}`}>
                {e.end_date
                  ? tf("panel.experience.line", { title: e.title, company: e.company, start: formatDay(e.start_date), end: formatDay(e.end_date) })
                  : tf("panel.experience.lineCurrent", { title: e.title, company: e.company, start: formatDay(e.start_date) })}
                {e.description ? <p className="texto-libre">{e.description}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {a.languages ? (
        <>
          <h3>{t("panel.shared.languages")}</h3>
          <ul>
            {a.languages.map((l) => (
              <li key={l.language.id}>
                {l.language.name}
                {" · "}
                {t(`form.proficiency.${l.proficiency}`)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {a.education ? (
        <>
          <h3>{t("panel.shared.education")}</h3>
          <p>{educacion || t("panel.shared.empty")}</p>
        </>
      ) : null}
      {"profile_description" in a ? (
        <>
          <h3>{t("panel.shared.description")}</h3>
          <p className="texto-libre">{a.profile_description || t("panel.shared.empty")}</p>
        </>
      ) : null}
      {contacto ? (
        <>
          <h3>{t("panel.shared.contact")}</h3>
          <dl className="ficha">
            {"email" in a ? (
              <div>
                <dt>{t("panel.contact.email")}</dt>
                <dd>{a.email}</dd>
              </div>
            ) : null}
            {"phone" in a ? (
              <div>
                <dt>{t("panel.contact.phone")}</dt>
                <dd>{a.phone || t("panel.shared.empty")}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
    </>
  );
}

/** Confirmar un cambio de estado, con una nota interna opcional. Trampa de foco sobre el texto y los botones. */
function DialogoMover({ to, nombre, revela, trabajando, error, onConfirmar, onCancelar }: { to: RecruiterTarget; nombre: string; revela: boolean; trabajando: boolean; error: string | null; onConfirmar: (nota: string) => void; onCancelar: () => void }) {
  const [nota, setNota] = useState("");
  const [local, setLocal] = useState(null as MessageKey | null);
  const dialogo = useRef(null as HTMLDivElement | null);

  useEffect(() => {
    dialogo.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, []);

  function confirmar() {
    if (countChars(nota.trim()) > NOTE_MAX) {
      setLocal("panel.moveDialog.noteTooLong");
      return;
    }
    setLocal(null);
    onConfirmar(nota);
  }

  function teclas(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      if (!trabajando) onCancelar();
      return;
    }
    if (ev.key !== "Tab" || !dialogo.current) return;
    const items = (Array.from(dialogo.current.querySelectorAll("textarea, button")) as HTMLButtonElement[]).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === primero) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primero.focus();
    }
  }

  const estado = applicationStatusLabel(to);
  const mensaje = local ? t(local) : error;
  return (
    <div className="velo">
      <div ref={dialogo} className="dialogo" role="dialog" aria-modal="true" aria-labelledby="mover-titulo" aria-describedby="mover-detalle" onKeyDown={teclas}>
        <h2 id="mover-titulo">{tf("panel.moveDialog.title", { status: estado })}</h2>
        <div id="mover-detalle">
          <p>{tf("panel.moveDialog.lead", { name: nombre, status: estado })}</p>
          {revela ? (
            <p>
              <strong>{t("panel.moveDialog.reveal")}</strong>
            </p>
          ) : null}
        </div>
        <div className="campo">
          <label htmlFor="mover-nota">{t("panel.moveDialog.note")}</label>
          <textarea id="mover-nota" rows={3} value={nota} disabled={trabajando} aria-describedby="mover-nota-ayuda" onChange={(ev) => setNota(ev.target.value)} />
          <p id="mover-nota-ayuda" className="campo__ayuda">
            {t("panel.moveDialog.noteHelp")}
          </p>
        </div>
        {mensaje ? (
          <div className="formulario__error" role="alert">
            {mensaje}
          </div>
        ) : null}
        <div className="dialogo__acciones">
          <button type="button" className="boton boton--borde" onClick={onCancelar} disabled={trabajando}>
            {t("panel.moveDialog.cancel")}
          </button>
          <button type="button" className="boton boton--coral" onClick={confirmar} disabled={trabajando}>
            {trabajando ? t("panel.moveDialog.working") : t("panel.moveDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel del reclutador de una oferta (FC5). Los datos de las personas viven solo en el estado de esta
 * página: sin almacenamiento del navegador, sin consola, sin cache compartida, y siempre como texto.
 */
export default function RecruiterPanel({ offerId }: { offerId: string }) {
  const [oferta, setOferta] = useState(null as OfferDetail | null);
  const [falloOferta, setFalloOferta] = useState(null as string | null);
  const [form, setForm] = useState(SIN_FILTROS);
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [gate, setGate] = useState(null as CompanyGate | null);
  const [seleccion, setSeleccion] = useState(null as string | null);
  const [detalle, setDetalle] = useState(null as PanelApplication | null);
  const [estadoDetalle, setEstadoDetalle] = useState("idle" as "idle" | "loading" | "ready" | "error");
  const [errorDetalle, setErrorDetalle] = useState(null as string | null);
  const [mover, setMover] = useState(null as RecruiterTarget | null);
  const [trabajando, setTrabajando] = useState(false);
  const [errorMover, setErrorMover] = useState(null as string | null);
  const [aviso, setAviso] = useState(null as string | null);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);
  const tituloDetalle = useRef(null as HTMLHeadingElement | null);

  useEffect(() => {
    let vivo = true;
    void companyApi.offer(offerId).then((r) => {
      if (!vivo) return;
      if (r.data) setOferta(r.data);
      else if (r.status !== 401) setFalloOferta(companyErrorText(r));
    });
    return () => {
      vivo = false;
    };
  }, [offerId]);

  const pagina = useCallback(
    async (cursor?: string) => {
      const r = await companyApi.panel(offerId, {
        limit: PAGINA,
        cursor,
        status: filtros.status || undefined,
        favorite: filtros.favorite === "" ? undefined : filtros.favorite === "true",
        sort: filtros.sort,
      });
      if (r.status === 403 && (r.error === "empresa_no_verificada" || r.error === "membresia_vencida")) setGate(r.error === "empresa_no_verificada" ? "unverified" : "expired");
      return r;
    },
    [offerId, filtros],
  );
  const { items, setItems, phase, hasMore, loadingMore, moreError, reload, more } = useCursorList(pagina);

  const cargarDetalle = useCallback(async (id: string) => {
    setEstadoDetalle("loading");
    setErrorDetalle(null);
    setAviso(null);
    const r = await companyApi.panelApplication(id);
    if (r.data) {
      setDetalle(r.data);
      setEstadoDetalle("ready");
    } else if (r.status !== 401) {
      setDetalle(null);
      setEstadoDetalle("error");
      setErrorDetalle(r.status === 429 && r.retryAfter ? tf("panel.error.rateLimitedIn", { wait: formatWait(r.retryAfter) }) : companyErrorText(r));
    }
  }, []);

  useEffect(() => {
    if (estadoDetalle === "ready") tituloDetalle.current?.focus();
  }, [estadoDetalle, seleccion]);

  function ver(id: string) {
    setSeleccion(id);
    void cargarDetalle(id);
  }

  function actualizarFila(id: string, cambio: Partial<PanelRow>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambio } : r)));
  }

  async function confirmarMover(nota: string) {
    if (!detalle || !mover || enVuelo.current) return;
    enVuelo.current = true;
    setTrabajando(true);
    setErrorMover(null);
    const r = await companyApi.move(detalle.id, mover, nota);
    enVuelo.current = false;
    setTrabajando(false);
    if (r.data) {
      setDetalle(r.data);
      actualizarFila(r.data.id, { status: r.data.status });
      setMover(null);
      setAviso(t("panel.moved"));
    } else if (r.status === 409 && r.currentStatus) {
      const vigente = r.currentStatus;
      setDetalle({ ...detalle, status: vigente });
      actualizarFila(detalle.id, { status: vigente });
      setMover(null);
      setAviso(tf("panel.error.stateNow", { status: applicationStatusLabel(vigente) }));
    } else if (r.status !== 401) {
      setErrorMover(companyErrorText(r));
    }
  }

  async function alternarFavorito() {
    if (!detalle || enVuelo.current) return;
    const nuevo = !detalle.is_favorite;
    enVuelo.current = true;
    setAviso(null);
    const r = await companyApi.setFavorite(detalle.id, nuevo);
    enVuelo.current = false;
    if (r.status === 204) {
      setDetalle({ ...detalle, is_favorite: nuevo });
      actualizarFila(detalle.id, { is_favorite: nuevo });
    } else if (r.status !== 401) {
      setAviso(companyErrorText(r));
    }
  }

  function filtrar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSeleccion(null);
    setDetalle(null);
    setEstadoDetalle("idle");
    setFiltros({ ...form });
  }

  const encabezado = (
    <>
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("panel.title")}</h1>
    </>
  );

  if (falloOferta) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="formulario__error" role="alert">
          {falloOferta}
        </p>
        <p>
          <Link className="boton boton--borde" href="/company/offers">
            {t("panel.toOffers")}
          </Link>
        </p>
      </main>
    );
  }
  if (gate) {
    return (
      <main className="pagina">
        {encabezado}
        <CompanyGateNotice gate={gate} link />
      </main>
    );
  }

  const opciones = detalle ? nextStatuses(detalle) : [];
  return (
    <main className="pagina pagina--panel">
      {encabezado}
      {oferta ? <p className="eslogan">{oferta.title}</p> : null}
      <p className="enlaces">
        <Link href={`/company/offers/${offerId}`}>{t("panel.backToOffer")}</Link>
        <Link href="/company/offers">{t("panel.toOffers")}</Link>
      </p>

      <form method="post" className="filtros" aria-label={t("panel.filter.title")} onSubmit={filtrar}>
        <div className="filtros__campos">
          <div className="campo">
            <label htmlFor="panel-estado">{t("panel.filter.status")}</label>
            <select id="panel-estado" value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as ApplicationStatus | "" }))}>
              <option value="">{t("panel.filter.any")}</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {applicationStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="panel-favorito">{t("panel.filter.favorite")}</label>
            <select id="panel-favorito" value={form.favorite} onChange={(ev) => setForm((f) => ({ ...f, favorite: ev.target.value as Filtros["favorite"] }))}>
              <option value="">{t("panel.filter.any")}</option>
              <option value="true">{t("panel.filter.favoriteOnly")}</option>
              <option value="false">{t("panel.filter.favoriteNot")}</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="panel-orden">{t("panel.filter.sort")}</label>
            <select id="panel-orden" value={form.sort} onChange={(ev) => setForm((f) => ({ ...f, sort: ev.target.value as PanelSort }))}>
              {PANEL_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(ORDEN[s])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="acciones acciones--juntas">
          <button type="submit" className="boton boton--borde">
            {t("panel.filter.apply")}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel__lista">
          {phase === "error" ? (
            <>
              <p className="formulario__error" role="alert">
                {t("panel.loadError")}
              </p>
              <button type="button" className="boton boton--borde" onClick={() => void reload()}>
                {t("panel.retry")}
              </button>
            </>
          ) : null}
          {phase === "loading" ? (
            <p role="status" aria-busy="true">
              {t("panel.loading")}
            </p>
          ) : null}
          {phase === "ready" && items.length === 0 ? <p className="aviso">{t("panel.empty")}</p> : null}
          {phase === "ready" && items.length > 0 ? (
            <>
              <ul className="lista" aria-label={t("panel.listLabel")}>
                {items.map((r) => {
                  const nombre = nombreDe(r);
                  return (
                    <li key={r.id} className="tarjeta" aria-current={seleccion === r.id ? "true" : undefined}>
                      <h2 className="tarjeta__titulo">{nombre}</h2>
                      <p className="etiqueta-estado">{applicationStatusLabel(r.status)}</p>
                      <p className="campo__ayuda">{tf("panel.appliedOn", { date: formatDate(r.applied_at) })}</p>
                      {r.is_favorite ? <p className="campo__ayuda">{t("panel.favorite.marked")}</p> : null}
                      <p>
                        <button
                          type="button"
                          className="boton boton--borde"
                          aria-label={tf("panel.view", { name: nombre })}
                          onClick={(ev) => {
                            disparador.current = ev.currentTarget;
                            ver(r.id);
                          }}
                        >
                          {t("panel.viewShort")}
                        </button>
                      </p>
                    </li>
                  );
                })}
              </ul>
              {moreError ? (
                <p className="formulario__error" role="alert">
                  {t("panel.moreError")}
                </p>
              ) : null}
              {hasMore ? (
                <div className="acciones">
                  <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
                    {loadingMore ? t("panel.moreLoading") : t("panel.more")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="panel__detalle">
          {estadoDetalle === "idle" ? <p className="campo__ayuda">{t("panel.detail.pick")}</p> : null}
          {estadoDetalle === "loading" ? <p role="status">{t("panel.detail.loading")}</p> : null}
          {estadoDetalle === "error" && errorDetalle ? (
            <p className="formulario__error" role="alert">
              {errorDetalle}
            </p>
          ) : null}
          {estadoDetalle === "ready" && detalle ? (
            <section aria-labelledby="detalle-nombre" className="tarjeta">
              <h2 id="detalle-nombre" ref={tituloDetalle} tabIndex={-1}>
                {nombreDe(detalle)}
              </h2>
              <p className="etiqueta-estado">{applicationStatusLabel(detalle.status)}</p>
              {aviso ? (
                <p className="formulario__aviso" role="status">
                  {aviso}
                </p>
              ) : null}
              {detalle.availability === "available" && detalle.applicant ? (
                <>
                  <div className="acciones acciones--juntas">
                    <button type="button" className="boton boton--borde" aria-pressed={detalle.is_favorite} onClick={() => void alternarFavorito()}>
                      {t("panel.favorite.toggle")}
                    </button>
                    {opciones.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className="boton boton--coral"
                        onClick={(ev) => {
                          disparador.current = ev.currentTarget;
                          setErrorMover(null);
                          setMover(o);
                        }}
                      >
                        {tf("panel.move", { status: applicationStatusLabel(o) })}
                      </button>
                    ))}
                  </div>
                  <Compartido a={detalle.applicant} />
                </>
              ) : (
                <p className="aviso">{t("panel.noData")}</p>
              )}
              <h3>{t("panel.history")}</h3>
              <ol>
                {detalle.history.map((h, i) => (
                  <li key={`${h.to}-${i}`}>
                    {h.from
                      ? tf("panel.history.entry", { from: applicationStatusLabel(h.from), to: applicationStatusLabel(h.to), date: formatDate(h.at) })
                      : tf("panel.history.first", { to: applicationStatusLabel(h.to), date: formatDate(h.at) })}
                    {h.note ? <p className="texto-libre campo__ayuda">{tf("panel.history.note", { note: h.note })}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      {mover && detalle ? (
        <DialogoMover
          to={mover}
          nombre={nombreDe(detalle)}
          revela={mover === "shortlisted" && Boolean(oferta?.is_confidential)}
          trabajando={trabajando}
          error={errorMover}
          onConfirmar={(nota) => void confirmarMover(nota)}
          onCancelar={() => {
            if (enVuelo.current) return;
            setMover(null);
            disparador.current?.focus();
          }}
        />
      ) : null}
    </main>
  );
}
