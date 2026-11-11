"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Icono } from "./icons";
import { goTo } from "@/lib/navigate";
import { consultaAUrl, CONSULTA_INICIAL } from "@/lib/offers/url";
import type { CatalogRef } from "@/lib/offers/types";
import { t } from "@/lib/messages";

/** Sin tildes ni mayúsculas: «Diseñadora» y «disenadora» son la misma búsqueda. */
const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Buscador de ofertas. El backend no busca texto libre: filtra por catálogo. Por eso el campo elige una
 * profesión (lista desplegable) y lleva a /offers con `profession_id`; los atajos usan el orden y los
 * tipos de contrato que /offers ya entiende por URL (lib/offers/url.ts).
 */
export default function OffersSearch({ professions, contractTypes }: { professions: CatalogRef[]; contractTypes: CatalogRef[] }) {
  const base = useId();
  const [texto, setTexto] = useState("");
  const [sinCoincidencia, setSinCoincidencia] = useState(false);

  function buscar(e: FormEvent) {
    e.preventDefault();
    const q = plano(texto);
    if (!q) return goTo("/offers");
    const hallada = professions.find((p) => plano(p.name) === q) ?? professions.find((p) => plano(p.name).includes(q));
    if (!hallada) return setSinCoincidencia(true);
    goTo(`/offers${consultaAUrl({ ...CONSULTA_INICIAL, filtros: { profession_id: hallada.id } })}`);
  }

  const atajos = [
    { key: "dashboard.search.recent" as const, href: "/offers", color: "indigo" },
    { key: "dashboard.search.match" as const, href: `/offers${consultaAUrl({ ...CONSULTA_INICIAL, sort: "match" })}`, color: "coral" },
  ];

  return (
    <section className="panel-seccion kpi c-mint" aria-labelledby={`${base}-t`}>
      <div className="kpi__cabecera">
        <span className="icono-chip">
          <Icono name="search" />
        </span>
        <h2 id={`${base}-t`}>
          {t("dashboard.search.title")}
        </h2>
      </div>
      <form className="buscador" role="search" aria-labelledby={`${base}-t`} onSubmit={buscar}>
        <div className="buscador__fila">
          <label className="solo-lectores" htmlFor={`${base}-q`}>
            {t("dashboard.search.label")}
          </label>
          <input
            id={`${base}-q`}
            className="buscador__campo"
            type="search"
            list={`${base}-l`}
            value={texto}
            placeholder={t("dashboard.search.placeholder")}
            aria-describedby={`${base}-ayuda`}
            autoComplete="off"
            onChange={(e) => {
              setTexto(e.target.value);
              setSinCoincidencia(false);
            }}
          />
          <datalist id={`${base}-l`}>
            {professions.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <button type="submit" className="boton boton--coral">
            {t("dashboard.search.submit")}
          </button>
        </div>
        <p className="buscador__ayuda" id={`${base}-ayuda`}>
          {t("dashboard.search.hint")}
        </p>
        {sinCoincidencia ? (
          <p className="buscador__ayuda" role="status">
            {t("dashboard.search.noMatch")}
          </p>
        ) : null}
      </form>
      <ul className="chips" aria-label={t("dashboard.search.quick")}>
        {atajos.map((a) => (
          <li key={a.key}>
            <Link className={`chip c-${a.color}`} href={a.href}>
              {t(a.key)}
            </Link>
          </li>
        ))}
        {contractTypes.slice(0, 3).map((c) => (
          <li key={c.id}>
            <Link className="chip c-mint" href={`/offers${consultaAUrl({ ...CONSULTA_INICIAL, filtros: { contract_type_id: c.id } })}`}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
