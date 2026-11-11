"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import CompanyGateNotice from "./CompanyGateNotice";
import { companyApi } from "@/lib/company/client";
import { companyErrorText } from "@/lib/company/errors";
import { companyGate, offerStatusLabel, type CompanyGate } from "@/lib/company/rules";
import { OFFER_STATUSES, type OfferRow, type OfferStatus } from "@/lib/company/types";
import { formatDay } from "@/lib/offers/format";
import { useCursorList } from "@/lib/offers/paging";
import { t, tf } from "@/lib/messages";

const PAGINA = 20;

/** /company/offers: las ofertas de mi empresa con su estado y sus aplicaciones; crear; FC8 si no puede publicar. */
export default function CompanyOffers() {
  const [estado, setEstado] = useState("" as OfferStatus | "");
  const [aplicado, setAplicado] = useState("" as OfferStatus | "");
  const [gate, setGate] = useState(null as CompanyGate | null);
  const [sinEmpresa, setSinEmpresa] = useState(false);
  const [error, setError] = useState(null as string | null);
  const lista = useRef(null as HTMLUListElement | null);

  const pagina = useCallback(
    async (cursor?: string) => {
      const r = await companyApi.offers({ limit: PAGINA, cursor, status: aplicado || undefined });
      setError(r.status === 403 ? companyErrorText(r) : null);
      if (r.status === 404) setSinEmpresa(true);
      return r;
    },
    [aplicado],
  );
  const { items, phase, hasMore, loadingMore, moreError, reload, more, firstNew } = useCursorList(pagina);

  useEffect(() => {
    let vivo = true;
    void companyApi.get().then((r) => {
      if (!vivo) return;
      if (r.data) setGate(companyGate(r.data));
      else if (r.status === 404) setSinEmpresa(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const desde = firstNew.current;
    if (desde === null) return;
    firstNew.current = null;
    lista.current?.children[desde]?.querySelector<HTMLElement>("a")?.focus();
  }, [items, firstNew]);

  function filtrar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setAplicado(estado);
  }

  const encabezado = (
    <>
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("companyOffers.title")}</h1>
    </>
  );

  if (sinEmpresa) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="aviso">{t("companyOffers.noCompany")}</p>
        <p>
          <Link className="boton boton--coral" href="/company">
            {t("companyOffers.toCompany")}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina">
      {encabezado}
      <p className="enlaces">
        <Link href="/company">{t("companyOffers.toCompany")}</Link>
        <Link href="/dashboard">{t("offers.back")}</Link>
      </p>
      {gate ? <CompanyGateNotice gate={gate} /> : null}
      <p>
        <Link className="boton boton--coral" href="/company/offers/new">
          {t("companyOffers.create")}
        </Link>
      </p>
      <form method="post" className="filtros" aria-label={t("companyOffers.filter.title")} onSubmit={filtrar}>
        <div className="filtros__campos">
          <div className="campo">
            <label htmlFor="ofertas-estado">{t("companyOffers.filter.status")}</label>
            <select id="ofertas-estado" value={estado} onChange={(ev) => setEstado(ev.target.value as OfferStatus | "")}>
              <option value="">{t("companyOffers.filter.any")}</option>
              {OFFER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {offerStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="acciones acciones--juntas">
          <button type="submit" className="boton boton--borde">
            {t("companyOffers.filter.apply")}
          </button>
        </div>
      </form>
      {error ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}
      {phase === "error" && !error ? (
        <>
          <p className="formulario__error" role="alert">
            {t("companyOffers.loadError")}
          </p>
          <button type="button" className="boton boton--borde" onClick={() => void reload()}>
            {t("companyOffers.retry")}
          </button>
        </>
      ) : null}
      {phase === "loading" ? (
        <p role="status" aria-busy="true">
          {t("companyOffers.loading")}
        </p>
      ) : null}
      {phase === "ready" && items.length === 0 ? <p className="aviso">{t("companyOffers.empty")}</p> : null}
      {phase === "ready" && items.length > 0 ? (
        <>
          <ul className="lista" ref={lista} aria-label={t("companyOffers.listLabel")}>
            {items.map((o: OfferRow) => (
              <li key={o.id} className="tarjeta">
                <h2 className="tarjeta__titulo">
                  <Link href={`/company/offers/${o.id}`}>{o.title}</Link>
                </h2>
                <p className="etiqueta-estado">
                  {offerStatusLabel(o.status)}
                  {o.is_confidential ? `${" · "}${t("companyOffers.confidential")}` : null}
                </p>
                <p className="campo__ayuda">{o.publication_date ? tf("offers.published", { date: formatDay(o.publication_date) }) : t("companyOffers.notPublished")}</p>
                {o.vacancies ? <p className="campo__ayuda">{o.vacancies === 1 ? t("offers.vacanciesOne") : tf("offers.vacancies", { n: o.vacancies })}</p> : null}
                <p>
                  <Link
                    href={`/company/offers/${o.id}/applications`}
                    aria-label={o.applications_count === 1 ? tf("companyOffers.applicationsOne", { title: o.title }) : tf("companyOffers.applications", { n: o.applications_count, title: o.title })}
                  >
                    {o.applications_count === 1 ? t("companyOffers.countOne") : tf("companyOffers.count", { n: o.applications_count })}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
          {moreError ? (
            <p className="formulario__error" role="alert">
              {t("companyOffers.moreError")}
            </p>
          ) : null}
          {hasMore ? (
            <div className="acciones">
              <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
                {loadingMore ? t("companyOffers.moreLoading") : t("companyOffers.more")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
