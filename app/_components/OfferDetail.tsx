"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ApplyDialog from "./ApplyDialog";
import { offersApi } from "@/lib/offers/client";
import { applicationStatusLabel, formatDay, placeOf, publicCompany, safeWebsite } from "@/lib/offers/format";
import type { Application, OfferPublic } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

type Par = [MessageKey, string | null | undefined];

function conValor(datos: Par[]): [MessageKey, string][] {
  return datos.filter((par): par is [MessageKey, string] => Boolean(par[1]));
}

/** Pares «etiqueta: valor» de una ficha; los vacíos no se pintan. */
function Ficha({ datos }: { datos: Par[] }) {
  const llenos = conValor(datos);
  if (llenos.length === 0) return null;
  return (
    <dl className="ficha">
      {llenos.map(([k, v]) => (
        <div key={k}>
          <dt>{t(k)}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function experiencia(n: number | null): string | null {
  if (n === null || n === undefined) return null;
  if (n === 0) return t("offer.experienceNone");
  return n === 1 ? t("offer.experienceOne") : tf("offer.experienceYears", { n });
}

const siNo = (v: boolean) => t(v ? "offer.yes" : "offer.no");

/**
 * Detalle de una oferta y sus requisitos, y «Aplicar» con el diálogo de consentimiento. Todo el texto
 * de la oferta lo escribe quien publica: se pinta como texto, nunca como HTML (SX7, OF10).
 */
export default function OfferDetail({ id }: { id: string }) {
  const [oferta, setOferta] = useState(null as OfferPublic | null);
  const [fallo, setFallo] = useState(null as "notFound" | "error" | null);
  const [abierto, setAbierto] = useState(false);
  const [recienAplicada, setRecienAplicada] = useState(false);
  const disparador = useRef(null as HTMLButtonElement | null);
  const aviso = useRef(null as HTMLDivElement | null);

  const cargar = useCallback(async () => {
    setFallo(null);
    const r = await offersApi.get(id);
    if (r.data) setOferta(r.data);
    else if (r.status === 404) setFallo("notFound");
    else if (r.status !== 401) setFallo("error");
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // «Aplicar» desaparece al aplicar: el foco pasa al enlace a «Mis aplicaciones».
  useEffect(() => {
    if (recienAplicada) aviso.current?.querySelector<HTMLElement>("a")?.focus();
  }, [recienAplicada]);

  function cerrar() {
    setAbierto(false);
    disparador.current?.focus();
  }

  function aplicada(a: Application) {
    setAbierto(false);
    setRecienAplicada(true);
    setOferta((o) => (o ? { ...o, my_application: { id: a.id, status: a.status } } : o));
  }

  if (fallo) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("offers.title")}</h1>
        <p className="formulario__error" role="alert">
          {t(fallo === "notFound" ? "offer.notFound" : "offer.loadError")}
        </p>
        {fallo === "error" ? (
          <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
            {t("offer.retry")}
          </button>
        ) : (
          <Link className="boton boton--coral" href="/offers">
            {t("offer.backToList")}
          </Link>
        )}
      </main>
    );
  }
  if (!oferta) {
    return (
      <main className="pagina" aria-busy="true">
        <p className="marca">{t("brand.name")}</p>
        <p role="status">{t("offer.loading")}</p>
      </main>
    );
  }

  // CA3: una confidencial no muestra empresa ni sitio, aunque la API los trajera.
  const empresa = publicCompany(oferta);
  const sitio = empresa ? safeWebsite(empresa.website) : null;
  const mia = oferta.my_application;

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{oferta.title}</h1>
      <p className="eslogan">
        {empresa ? empresa.name : t("offers.confidential")}
        {placeOf(oferta) ? `${" · "}${placeOf(oferta)}` : null}
      </p>
      {oferta.confidential ? <p className="aviso">{t("offer.confidentialNotice")}</p> : null}
      {sitio ? (
        <p>
          <a href={sitio} rel="nofollow noopener noreferrer">
            {t("offer.website")}
          </a>
        </p>
      ) : null}
      <p className="campo__ayuda">{tf("offers.published", { date: formatDay(oferta.publication_date) })}</p>

      <div className="acciones" ref={aviso}>
        {recienAplicada ? (
          <p className="formulario__aviso" role="status">
            {t("offer.appliedNow")}
          </p>
        ) : null}
        {!recienAplicada && mia ? <p className="aviso">{tf("offer.applied", { status: applicationStatusLabel(mia.status) })}</p> : null}
        {recienAplicada || mia ? (
          <Link className="boton boton--borde" href="/applications">
            {t("offers.toApplications")}
          </Link>
        ) : (
          <button type="button" ref={disparador} className="boton boton--coral" onClick={() => setAbierto(true)}>
            {t("offer.apply")}
          </button>
        )}
      </div>

      <section aria-labelledby="oferta-descripcion">
        <h2 id="oferta-descripcion">{t("offer.description")}</h2>
        <p className="texto-libre">{oferta.description}</p>
      </section>

      <section aria-labelledby="oferta-condiciones">
        <h2 id="oferta-condiciones">{t("offer.conditions")}</h2>
        <Ficha
          datos={[
            ["offers.field.profession", oferta.profession?.name],
            ["offers.field.sector", oferta.employment_sector?.name],
            ["offers.field.contract", oferta.contract_type?.name],
            ["offers.field.salary", oferta.salary_range?.name],
            ["offers.field.shift", oferta.working_shift?.name],
            ["offer.schedule", oferta.schedule],
            ["offers.field.vacancies", oferta.vacancies === 1 ? t("offers.vacanciesOne") : tf("offers.vacancies", { n: oferta.vacancies })],
            ["offer.hiringDate", oferta.hiring_date ? formatDay(oferta.hiring_date) : null],
          ]}
        />
      </section>

      <section aria-labelledby="oferta-requisitos">
        <h2 id="oferta-requisitos">{t("offer.requirements")}</h2>
        <Ficha
          datos={[
            ["offer.experience", experiencia(oferta.required_experience)],
            ["offer.academicLevel", oferta.minimum_academic_level?.name],
            ["offer.hierarchy", oferta.job_hierarchy?.name],
            ["offer.mainLanguage", oferta.main_language?.name],
            ["offer.travel", siNo(oferta.required_availability_to_travel)],
            ["offer.driverLicense", siNo(oferta.required_driver_license)],
          ]}
        />
        {oferta.skills.length > 0 ? (
          <>
            <h3 id="oferta-skills">{t("offer.skills")}</h3>
            <ul aria-labelledby="oferta-skills">
              {oferta.skills.map((s) => (
                <li key={s.skill.id}>
                  {s.skill.name}
                  {" · "}
                  {t(s.is_required ? "offer.skill.required" : "offer.skill.optional")}
                  {s.min_level ? `${" · "}${tf("offer.skill.minLevel", { level: t(`form.level.${s.min_level}`) })}` : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {oferta.languages.length > 0 ? (
          <>
            <h3 id="oferta-idiomas">{t("offer.languages")}</h3>
            <ul aria-labelledby="oferta-idiomas">
              {oferta.languages.map((l) => (
                <li key={l.language.id}>
                  {l.language.name}
                  {l.min_proficiency ? `${" · "}${tf("offer.language.minLevel", { level: t(`form.proficiency.${l.min_proficiency}`) })}` : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {oferta.driver_licenses.length > 0 ? (
          <>
            <h3 id="oferta-licencias">{t("offer.licenses")}</h3>
            <ul aria-labelledby="oferta-licencias">
              {oferta.driver_licenses.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <p>
        <Link href="/offers">{t("offer.backToList")}</Link>
      </p>

      {abierto ? <ApplyDialog offerId={oferta.id} confidential={oferta.confidential} onCancel={cerrar} onApplied={aplicada} /> : null}
    </main>
  );
}
