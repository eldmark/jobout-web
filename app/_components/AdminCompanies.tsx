"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { adminApi } from "@/lib/company/client";
import { companyErrorText } from "@/lib/company/errors";
import { validateMembership } from "@/lib/company/rules";
import type { AdminCompany } from "@/lib/company/types";
import { formatDate } from "@/lib/interviews/format";
import { useCursorList } from "@/lib/offers/paging";
import { t, tf, type MessageKey } from "@/lib/messages";

const PAGINA = 20;

/** Membresía de una empresa: tipo `business` (el único de la 5a), inicio y fin. */
function Membresia({ empresa }: { empresa: AdminCompany }) {
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [error, setError] = useState(null as string | null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  const id = `membresia-${empresa.id}`;

  async function guardar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current) return;
    setListo(false);
    const invalida = validateMembership(inicio, fin);
    if (invalida) {
      setError(t(invalida));
      return;
    }
    setError(null);
    enVuelo.current = true;
    setEnviando(true);
    const r = await adminApi.setMembership(empresa.id, inicio, fin);
    enVuelo.current = false;
    setEnviando(false);
    if (r.status === 204) setListo(true);
    else if (r.status !== 401) setError(r.status === 422 ? t("admin.membership.error") : companyErrorText(r));
  }

  return (
    <form method="post" className="filtros" aria-label={tf("admin.actionLabel", { action: t("admin.membership.title"), name: empresa.name })} onSubmit={(ev) => void guardar(ev)} noValidate>
      <p className="campo__ayuda">{t("admin.membership.lead")}</p>
      {error ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="filtros__campos">
        <div className="campo">
          <label htmlFor={`${id}-inicio`}>{t("admin.membership.start")}</label>
          <input id={`${id}-inicio`} type="date" value={inicio} onChange={(ev) => setInicio(ev.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-fin`}>{t("admin.membership.end")}</label>
          <input id={`${id}-fin`} type="date" value={fin} onChange={(ev) => setFin(ev.target.value)} />
        </div>
      </div>
      <div className="acciones acciones--juntas">
        <button type="submit" className="boton boton--borde" disabled={enviando} aria-label={tf("admin.actionLabel", { action: t("admin.membership.save"), name: empresa.name })}>
          {t("admin.membership.save")}
        </button>
      </div>
      {listo ? (
        <p className="formulario__aviso" role="status">
          {t("admin.membership.saved")}
        </p>
      ) : null}
    </form>
  );
}

/**
 * /admin/companies (solo el admin de plataforma, con el permiso de verificar empresas): la cola de empresas por verificar,
 * verificar o quitar la verificación y fijar la membresía. La verificación de verdad (dominio,
 * documento) se hace fuera; aquí se marca.
 */
export default function AdminCompanies() {
  const [vista, setVista] = useState("false" as "false" | "true");
  const [aplicada, setAplicada] = useState("false" as "false" | "true");
  const [sinPermiso, setSinPermiso] = useState(false);
  const [aviso, setAviso] = useState(null as MessageKey | null);
  const [error, setError] = useState(null as string | null);
  const [aQuitar, setAQuitar] = useState(null as AdminCompany | null);
  const [trabajando, setTrabajando] = useState(false);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);

  const pagina = useCallback(
    async (cursor?: string) => {
      const r = await adminApi.companies({ verified: aplicada === "true", limit: PAGINA, cursor });
      setSinPermiso(r.status === 403);
      return r;
    },
    [aplicada],
  );
  const { items, setItems, phase, hasMore, loadingMore, moreError, reload, more } = useCursorList(pagina);

  async function cambiar(empresa: AdminCompany, accion: "verify" | "unverify") {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setTrabajando(true);
    setError(null);
    setAviso(null);
    const r = accion === "verify" ? await adminApi.verify(empresa.id) : await adminApi.unverify(empresa.id);
    enVuelo.current = false;
    setTrabajando(false);
    if (r.status === 204) {
      // Sale de esta lista: pasa a la otra.
      setItems((prev) => prev.filter((x) => x.id !== empresa.id));
      setAQuitar(null);
      setAviso(accion === "verify" ? "admin.verifiedDone" : "admin.unverifiedDone");
    } else if (r.status !== 401) {
      setError(r.status === 403 ? t("admin.error.ownCompany") : companyErrorText(r));
    }
  }

  function filtrar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setAviso(null);
    setError(null);
    setAplicada(vista);
  }

  const encabezado = (
    <>
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("admin.title")}</h1>
    </>
  );

  if (sinPermiso) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="formulario__error" role="alert">
          {t("admin.error.noPermission")}
        </p>
        <p>
          <Link href="/dashboard">{t("offers.back")}</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina">
      {encabezado}
      <p className="eslogan">{t("admin.lead")}</p>
      <p className="enlaces">
        <Link href="/dashboard">{t("offers.back")}</Link>
      </p>
      <form method="post" className="filtros" aria-label={t("admin.filter.title")} onSubmit={filtrar}>
        <div className="filtros__campos">
          <div className="campo">
            <label htmlFor="admin-vista">{t("admin.filter.label")}</label>
            <select id="admin-vista" value={vista} onChange={(ev) => setVista(ev.target.value as "false" | "true")}>
              <option value="false">{t("admin.filter.pending")}</option>
              <option value="true">{t("admin.filter.verified")}</option>
            </select>
          </div>
        </div>
        <div className="acciones acciones--juntas">
          <button type="submit" className="boton boton--borde">
            {t("admin.filter.apply")}
          </button>
        </div>
      </form>
      {aviso ? (
        <p className="formulario__aviso" role="status">
          {t(aviso)}
        </p>
      ) : null}
      {error && !aQuitar ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}
      {phase === "error" ? (
        <>
          <p className="formulario__error" role="alert">
            {t("admin.loadError")}
          </p>
          <button type="button" className="boton boton--borde" onClick={() => void reload()}>
            {t("admin.retry")}
          </button>
        </>
      ) : null}
      {phase === "loading" ? (
        <p role="status" aria-busy="true">
          {t("admin.loading")}
        </p>
      ) : null}
      {phase === "ready" && items.length === 0 ? <p className="aviso">{t("admin.empty")}</p> : null}
      {phase === "ready" && items.length > 0 ? (
        <>
          <ul className="lista" aria-label={t("admin.listLabel")}>
            {items.map((c) => (
              <li key={c.id} className="tarjeta">
                <h2 className="tarjeta__titulo">{c.name}</h2>
                <dl className="ficha">
                  <div>
                    <dt>{t("companyForm.field.taxId")}</dt>
                    <dd>{c.tax_id}</dd>
                  </div>
                  {c.website ? (
                    <div>
                      <dt>{t("company.data.website")}</dt>
                      <dd>{c.website}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t("admin.created")}</dt>
                    <dd>{formatDate(c.created_at)}</dd>
                  </div>
                  {c.verified_at ? (
                    <div>
                      <dt>{t("admin.verifiedAt")}</dt>
                      <dd>{formatDate(c.verified_at)}</dd>
                    </div>
                  ) : null}
                </dl>
                {c.creator_email_domain ? <p className="campo__ayuda">{tf("admin.domain", { domain: c.creator_email_domain })}</p> : null}
                <p className="campo__ayuda">{tf("admin.recruiters", { n: c.recruiters_count })}</p>
                <div className="acciones acciones--juntas">
                  {c.verified_at ? (
                    <button
                      type="button"
                      className="boton boton--peligro"
                      disabled={trabajando}
                      aria-label={tf("admin.actionLabel", { action: t("admin.unverify"), name: c.name })}
                      onClick={(ev) => {
                        disparador.current = ev.currentTarget;
                        setError(null);
                        setAQuitar(c);
                      }}
                    >
                      {t("admin.unverify")}
                    </button>
                  ) : (
                    <button type="button" className="boton boton--coral" disabled={trabajando} aria-label={tf("admin.actionLabel", { action: t("admin.verify"), name: c.name })} onClick={() => void cambiar(c, "verify")}>
                      {t("admin.verify")}
                    </button>
                  )}
                </div>
                <Membresia empresa={c} />
              </li>
            ))}
          </ul>
          {moreError ? (
            <p className="formulario__error" role="alert">
              {t("admin.moreError")}
            </p>
          ) : null}
          {hasMore ? (
            <div className="acciones">
              <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
                {loadingMore ? t("admin.moreLoading") : t("admin.more")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {aQuitar ? (
        <ConfirmDialog
          titleKey="admin.unverifyDialog.title"
          confirmKey="admin.unverifyDialog.confirm"
          workingKey="admin.unverifyDialog.working"
          cancelKey="admin.unverifyDialog.cancel"
          working={trabajando}
          errorText={error}
          onConfirm={() => void cambiar(aQuitar, "unverify")}
          onCancel={() => {
            if (enVuelo.current) return;
            setAQuitar(null);
            disparador.current?.focus();
          }}
        >
          <p>
            <strong>{aQuitar.name}</strong>
          </p>
          <p>{t("admin.unverifyDialog.warning")}</p>
        </ConfirmDialog>
      ) : null}
    </main>
  );
}
