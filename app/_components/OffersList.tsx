"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { offersApi, type CatalogName } from "@/lib/offers/client";
import { applicationStatusLabel, formatDay, placeOf, publicCompany } from "@/lib/offers/format";
import { isMatch } from "@/lib/offers/match";
import { useCursorList } from "@/lib/offers/paging";
import { OFFER_SORTS, type CatalogRef, type OfferFilter, type OfferSort, type OfferSummary } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

const PAGINA = 20;

type Filtros = Partial<Record<OfferFilter, string>>;

/** Cada filtro con su catálogo y su etiqueta. El municipio depende del departamento. */
const FILTROS: { campo: OfferFilter; catalogo: CatalogName; etiqueta: MessageKey }[] = [
  { campo: "profession_id", catalogo: "professions", etiqueta: "offers.filters.profession" },
  { campo: "state_id", catalogo: "states", etiqueta: "offers.filters.state" },
  { campo: "city_id", catalogo: "cities", etiqueta: "offers.filters.city" },
  { campo: "contract_type_id", catalogo: "contract-types", etiqueta: "offers.filters.contract" },
  { campo: "salary_range_id", catalogo: "salary-ranges", etiqueta: "offers.filters.salary" },
  { campo: "working_shift_id", catalogo: "working-shifts", etiqueta: "offers.filters.shift" },
  { campo: "employment_sector_id", catalogo: "employment-sectors", etiqueta: "offers.filters.sector" },
  { campo: "job_hierarchy_id", catalogo: "job-hierarchies", etiqueta: "offers.filters.hierarchy" },
];
const ORDEN: Record<OfferSort, MessageKey> = { recent: "offers.filters.sort.recent", oldest: "offers.filters.sort.oldest", match: "offers.filters.sort.match" };
/** Los catálogos que se cargan al abrir la página (el de municipios va por departamento). */
const FIJOS = FILTROS.filter((f) => f.campo !== "city_id");

/** La consulta aplicada (lo que se pidió al backend), distinta de lo que se está editando en el formulario. */
interface Consulta {
  sort: OfferSort;
  filtros: Filtros;
}
const SIN_FILTROS: Consulta = { sort: "recent", filtros: {} };

function Tarjeta({ o }: { o: OfferSummary }) {
  const empresa = publicCompany(o);
  const lugar = placeOf(o);
  const datos: [MessageKey, string | undefined][] = [
    ["offers.field.place", lugar || undefined],
    ["offers.field.profession", o.profession?.name],
    ["offers.field.sector", o.employment_sector?.name],
    ["offers.field.contract", o.contract_type?.name],
    ["offers.field.salary", o.salary_range?.name],
    ["offers.field.shift", o.working_shift?.name],
    ["offers.field.vacancies", o.vacancies === 1 ? t("offers.vacanciesOne") : tf("offers.vacancies", { n: o.vacancies })],
  ];
  return (
    <li className="tarjeta">
      <h2 className="tarjeta__titulo">
        <Link href={`/offers/${o.id}`}>{o.title}</Link>
      </h2>
      {/* CA3: una confidencial nunca muestra la empresa, la mande o no la API. */}
      <p className="tarjeta__empresa">{empresa ? empresa.name : t("offers.confidential")}</p>
      <dl className="ficha">
        {datos
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{t(k)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {isMatch(o.match) ? (
        <p className="afinidad__chip">
          {tf("match.score", { n: o.match.score })}
          <span className="afinidad__pista" aria-hidden="true">
            <span className="afinidad__barra" style={{ width: `${o.match.score}%` }} />
          </span>
        </p>
      ) : null}
      <p className="campo__ayuda">{tf("offers.published", { date: formatDay(o.publication_date) })}</p>
      {o.my_application ? <p className="etiqueta-estado">{tf("offers.appliedBadge", { status: applicationStatusLabel(o.my_application.status) })}</p> : null}
    </li>
  );
}

/** HU-30: ofertas visibles con filtros de catálogo, afinidad (5b) y «Cargar más». Sin buscador de texto ni filtro por empresa. */
export default function OffersList() {
  const [consulta, setConsulta] = useState(SIN_FILTROS);
  const [form, setForm] = useState(SIN_FILTROS);
  const [catalogos, setCatalogos] = useState(null as Partial<Record<CatalogName, CatalogRef[]>> | null);
  const [falloCatalogos, setFalloCatalogos] = useState(false);
  const [municipios, setMunicipios] = useState([] as CatalogRef[]);
  const lista = useRef(null as HTMLUListElement | null);

  const pagina = useCallback((cursor?: string) => offersApi.list({ limit: PAGINA, cursor, sort: consulta.sort, filters: consulta.filtros }), [consulta]);
  const { items, phase, hasMore, loadingMore, moreError, reload, more, firstNew, head } = useCursorList(pagina);

  useEffect(() => {
    let vivo = true;
    void Promise.all(FIJOS.map((f) => offersApi.catalog(f.catalogo))).then((rs) => {
      if (!vivo) return;
      if (rs.some((r) => !r.data)) {
        if (rs.every((r) => r.status !== 401)) setFalloCatalogos(true);
        return;
      }
      setCatalogos(Object.fromEntries(FIJOS.map((f, i) => [f.catalogo, rs[i].data ?? []])));
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Los municipios se piden por departamento; sin departamento, el filtro no aplica.
  const estado = form.filtros.state_id;
  useEffect(() => {
    let vivo = true;
    setMunicipios([]);
    if (estado) {
      void offersApi.catalog("cities", estado).then((r) => {
        if (vivo && r.data) setMunicipios(r.data);
      });
    }
    return () => {
      vivo = false;
    };
  }, [estado]);

  // El botón «Cargar más» puede desaparecer: el foco pasa a la primera oferta nueva.
  useEffect(() => {
    const desde = firstNew.current;
    if (desde === null) return;
    firstNew.current = null;
    lista.current?.children[desde]?.querySelector<HTMLElement>("a")?.focus();
  }, [items, firstNew]);

  function elegir(campo: OfferFilter, valor: string) {
    setForm((f) => {
      const filtros = { ...f.filtros, [campo]: valor };
      if (campo === "state_id") filtros.city_id = "";
      return { ...f, filtros };
    });
  }

  function filtrar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setConsulta({ sort: form.sort, filtros: { ...form.filtros } });
  }

  function limpiar() {
    setForm(SIN_FILTROS);
    setConsulta(SIN_FILTROS);
  }

  const conFiltros = Object.values(consulta.filtros).some(Boolean);
  const selector = (campo: OfferFilter, etiqueta: MessageKey, opciones: CatalogRef[], deshabilitado = false, ayuda?: string) => {
    return (
      <div className="campo" key={campo}>
        <label htmlFor={`filtro-${campo}`}>{t(etiqueta)}</label>
        <select id={`filtro-${campo}`} value={form.filtros[campo] ?? ""} disabled={deshabilitado} aria-describedby={ayuda} onChange={(ev) => elegir(campo, ev.target.value)}>
          <option value="">{t("offers.filters.any")}</option>
          {opciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("offers.title")}</h1>
      <p className="eslogan">{t("offers.lead")}</p>
      <p className="enlaces">
        <Link href="/applications">{t("offers.toApplications")}</Link>
        <Link href="/dashboard">{t("offers.back")}</Link>
      </p>

      <form method="post" className="filtros" aria-labelledby="filtros-titulo" onSubmit={filtrar}>
        <h2 id="filtros-titulo">{t("offers.filters.title")}</h2>
        {falloCatalogos ? <p className="aviso">{t("offers.filters.loadError")}</p> : null}
        <div className="filtros__campos">
          {FILTROS.map((f) =>
            f.campo === "city_id"
              ? selector(f.campo, f.etiqueta, municipios, !estado, !estado ? "filtro-ciudad-ayuda" : undefined)
              : selector(f.campo, f.etiqueta, catalogos?.[f.catalogo] ?? []),
          )}
          <div className="campo">
            <label htmlFor="filtro-sort">{t("offers.filters.sort")}</label>
            <select id="filtro-sort" value={form.sort} onChange={(ev) => setForm((f) => ({ ...f, sort: ev.target.value as OfferSort }))}>
              {OFFER_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(ORDEN[s])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p id="filtro-ciudad-ayuda" className="campo__ayuda" hidden={Boolean(estado)}>
          {t("offers.filters.cityFirst")}
        </p>
        <div className="acciones acciones--juntas">
          <button type="submit" className="boton boton--coral">
            {t("offers.filters.apply")}
          </button>
          <button type="button" className="boton boton--borde" onClick={limpiar}>
            {t("offers.filters.clear")}
          </button>
        </div>
      </form>

      <div className="resultados">
        {phase === "ready" && head?.match_unavailable === "perfil_vacio" ? (
          <p className="aviso" role="status">
            {t("offers.match.unavailable")} <Link href="/profile">{t("offers.match.unavailableLink")}</Link>
          </p>
        ) : null}
        {phase === "error" ? (
          <>
            <p className="formulario__error" role="alert">
              {t("offers.loadError")}
            </p>
            <button type="button" className="boton boton--borde" onClick={() => void reload()}>
              {t("offers.retry")}
            </button>
          </>
        ) : null}
        {phase === "loading" ? (
          <p role="status" aria-busy="true">
            {t("offers.loading")}
          </p>
        ) : null}
        {phase === "ready" && items.length === 0 ? <p className="aviso">{t(conFiltros ? "offers.emptyFiltered" : "offers.empty")}</p> : null}
        {phase === "ready" && items.length > 0 ? (
          <>
            <p className="solo-lectores" role="status">
              {items.length === 1 ? t("offers.shownOne") : tf("offers.shown", { n: items.length })}
            </p>
            <ul className="lista" ref={lista} aria-label={t("offers.listLabel")}>
              {items.map((o) => (
                <Tarjeta key={o.id} o={o} />
              ))}
            </ul>
            {moreError ? (
              <p className="formulario__error" role="alert">
                {t("offers.moreError")}
              </p>
            ) : null}
            {hasMore ? (
              <div className="acciones">
                <button type="button" className="boton boton--borde" onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}>
                  {loadingMore ? t("offers.moreLoading") : t("offers.more")}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
