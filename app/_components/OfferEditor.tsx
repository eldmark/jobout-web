"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { companyApi } from "@/lib/company/client";
import { companyErrorText } from "@/lib/company/errors";
import {
  companyGate,
  emptyOfferForm,
  fromOfferDetail,
  frozenFields,
  missingToPublish,
  offerActions,
  offerStatusLabel,
  toOfferInput,
  validateOffer,
  type CompanyGate,
  type OfferErrors,
  type OfferForm,
} from "@/lib/company/rules";
import { PUBLISH_FIELDS, type OfferDetail, type OfferInput } from "@/lib/company/types";
import { todayLocal } from "@/lib/offers/external";
import { offersApi, type CatalogName } from "@/lib/offers/client";
import type { CatalogRef } from "@/lib/offers/types";
import { goTo } from "@/lib/navigate";
import { t, tf, type MessageKey } from "@/lib/messages";

const NIVELES = ["beginner", "intermediate", "advanced", "expert"] as const;
const DOMINIOS = ["native", "advanced", "intermediate", "basic"] as const;

/** Los selectores de catálogo del formulario, con su campo y su etiqueta (el municipio va aparte). */
const SELECTORES: { campo: keyof OfferForm & keyof OfferInput; catalogo: CatalogName; etiqueta: MessageKey }[] = [
  { campo: "profession_id", catalogo: "professions", etiqueta: "offerForm.field.profession" },
  { campo: "employment_sector_id", catalogo: "employment-sectors", etiqueta: "offerForm.field.sector" },
  { campo: "job_hierarchy_id", catalogo: "job-hierarchies", etiqueta: "offerForm.field.hierarchy" },
  { campo: "minimum_academic_level_id", catalogo: "academic-levels", etiqueta: "offerForm.field.academicLevel" },
  { campo: "main_language_id", catalogo: "languages", etiqueta: "offerForm.field.mainLanguage" },
  { campo: "contract_type_id", catalogo: "contract-types", etiqueta: "offerForm.field.contract" },
  { campo: "salary_range_id", catalogo: "salary-ranges", etiqueta: "offerForm.field.salary" },
  { campo: "working_shift_id", catalogo: "working-shifts", etiqueta: "offerForm.field.shift" },
];
function catalogoDe(s: { catalogo: CatalogName }): CatalogName {
  return s.catalogo;
}
const CATALOGOS: CatalogName[] = [...SELECTORES.map(catalogoDe), "states", "skills", "driver-licenses"];
/** Orden de los campos con error: el foco va al primero. */
const ORDEN: (keyof OfferForm)[] = ["title", "description", "required_experience", "schedule", "vacancies", "hiring_date", "skills", "languages", "driver_license_ids"];
const FALTA: Record<(typeof PUBLISH_FIELDS)[number], MessageKey> = {
  "title": "offerForm.missing.title",
  "description": "offerForm.missing.description",
  vacancies: "offerForm.missing.vacancies",
  profession_id: "offerForm.missing.profession_id",
  state_id: "offerForm.missing.state_id",
  city_id: "offerForm.missing.city_id",
  requirements: "offerForm.missing.requirements",
  hiring_date: "offerForm.missing.hiring_date",
};
const faltantes = (fields: string[]) =>
  tf("offerForm.publish.missing", { fields: fields.filter((f): f is keyof typeof FALTA => f in FALTA).map((f) => t(FALTA[f])).join(", ") });

type Dialogo = "close" | "remove" | null;

/**
 * Crear o editar una oferta (OfferInput), con sus requisitos, y publicarla, pausarla, cerrarla o borrar
 * el borrador. Los textos de la oferta se editan en campos y nunca se pintan como HTML (OF10, SX7).
 */
export default function OfferEditor({ id }: { id?: string }) {
  const [detalle, setDetalle] = useState(null as OfferDetail | null);
  const [form, setForm] = useState(emptyOfferForm());
  const [fallo, setFallo] = useState(null as string | null);
  const [catalogos, setCatalogos] = useState({} as Partial<Record<CatalogName, CatalogRef[]>>);
  const [municipios, setMunicipios] = useState([] as CatalogRef[]);
  const [gate, setGate] = useState(null as CompanyGate | null);
  const [errores, setErrores] = useState({} as OfferErrors);
  const [error, setError] = useState(null as string | null);
  const [aviso, setAviso] = useState(null as MessageKey | null);
  const [trabajando, setTrabajando] = useState(false);
  const [dialogo, setDialogo] = useState(null as Dialogo);
  const [skill, setSkill] = useState("");
  const [idioma, setIdioma] = useState("");
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setFallo(null);
    const r = await companyApi.offer(id);
    if (r.data) {
      setDetalle(r.data);
      setForm(fromOfferDetail(r.data));
    } else if (r.status !== 401) {
      setFallo(companyErrorText(r));
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    let vivo = true;
    void Promise.all(CATALOGOS.map((c) => offersApi.catalog(c))).then((rs) => {
      if (vivo) setCatalogos(Object.fromEntries(CATALOGOS.map((c, i) => [c, rs[i].data ?? []])));
    });
    void companyApi.get().then((r) => {
      if (vivo && r.data) setGate(companyGate(r.data));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const estado = form.state_id;
  useEffect(() => {
    let vivo = true;
    if (!estado) {
      setMunicipios([]);
      return;
    }
    void offersApi.catalog("cities", estado).then((r) => {
      if (vivo && r.data) setMunicipios(r.data);
    });
    return () => {
      vivo = false;
    };
  }, [estado]);

  const cerrada = detalle?.status === "closed";
  const congelados = detalle ? frozenFields(detalle) : new Set<keyof OfferInput>();
  const bloqueado = (k: keyof OfferInput) => trabajando || cerrada || congelados.has(k);
  const sinGuardar = detalle !== null && JSON.stringify(toOfferInput(form)) !== JSON.stringify(toOfferInput(fromOfferDetail(detalle)));
  const nombreDe = (catalogo: CatalogName, idCat: string) => {
    return catalogos[catalogo]?.find((c) => c.id === idCat)?.name ?? "";
  };
  const set = <K extends keyof OfferForm>(k: K, v: OfferForm[K]) => {
    setAviso(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  async function guardar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current || cerrada) return;
    const errs = validateOffer(form, todayLocal());
    setErrores(errs);
    setError(null);
    setAviso(null);
    const primero = ORDEN.find((k) => errs[k]);
    if (primero) {
      document.getElementById(`oferta-${primero}`)?.focus();
      return;
    }
    const entrada = toOfferInput(form);
    enVuelo.current = true;
    setTrabajando(true);
    const r = id ? await companyApi.updateOffer(id, entrada) : await companyApi.createOffer(entrada);
    enVuelo.current = false;
    setTrabajando(false);
    if (!id && r.status === 201 && r.data) {
      goTo(`/company/offers/${r.data.id}`);
    } else if (id && r.status === 204 && detalle) {
      setDetalle({ ...detalle, ...entrada });
      setAviso("offerForm.saved");
    } else if (r.status !== 401) {
      setError(companyErrorText(r));
    }
  }

  /** Publicar, pausar o cerrar: una sola llamada a la vez. */
  async function transicion(accion: "publish" | "pause" | "close") {
    if (!id || !detalle || enVuelo.current) return;
    enVuelo.current = true;
    setTrabajando(true);
    setError(null);
    setAviso(null);
    const r = accion === "publish" ? await companyApi.publishOffer(id) : accion === "pause" ? await companyApi.pauseOffer(id) : await companyApi.closeOffer(id);
    enVuelo.current = false;
    setTrabajando(false);
    if (accion === "publish" && r.status === 200 && r.data) {
      const p = r.data as { status: OfferDetail["status"]; publication_date: string };
      setDetalle({ ...detalle, status: p.status, publication_date: p.publication_date });
      setAviso("offerForm.published");
    } else if (r.status === 204) {
      setDetalle({ ...detalle, status: accion === "pause" ? "paused" : "closed" });
      setDialogo(null);
      setAviso(accion === "pause" ? "offerForm.paused" : "offerForm.closed");
    } else if (r.status !== 401) {
      setError(r.error === "oferta_incompleta" && r.fields?.length ? faltantes(r.fields) : companyErrorText(r));
    }
  }

  async function borrar() {
    if (!id || enVuelo.current) return;
    enVuelo.current = true;
    setTrabajando(true);
    setError(null);
    const r = await companyApi.deleteOffer(id);
    enVuelo.current = false;
    setTrabajando(false);
    if (r.status === 204) goTo("/company/offers");
    else if (r.status !== 401) setError(companyErrorText(r));
  }

  function cerrarDialogo() {
    if (enVuelo.current) return;
    setDialogo(null);
    disparador.current?.focus();
  }

  const encabezado = (
    <>
      <p className="marca">{t("brand.name")}</p>
      <h1>{t(id ? "offerForm.titleEdit" : "offerForm.titleNew")}</h1>
    </>
  );

  if (fallo) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="formulario__error" role="alert">
          {fallo}
        </p>
        <p>
          <Link className="boton boton--borde" href="/company/offers">
            {t("offerForm.backToList")}
          </Link>
        </p>
      </main>
    );
  }
  if (id && !detalle) {
    return (
      <main className="pagina" aria-busy="true">
        {encabezado}
        <p role="status">{t("offerForm.loading")}</p>
      </main>
    );
  }

  const hayErrores = ORDEN.some((k) => Boolean(errores[k]));
  const acciones = detalle ? offerActions(detalle) : null;
  const faltan = detalle ? missingToPublish(detalle, todayLocal()) : [];
  const motivo = gate && gate !== "ok" ? t(`company.gate.${gate}.short`) : sinGuardar ? t("offerForm.publish.saveFirst") : faltan.length > 0 ? faltantes(faltan) : null;

  const describir = (k: keyof OfferForm, extra?: string) => [extra, errores[k] ? `oferta-${k}-error` : ""].filter(Boolean).join(" ") || undefined;
  const errorDe = (k: keyof OfferForm) => {
    const clave = errores[k];
    return clave ? (
      <p id={`oferta-${k}-error`} className="campo__error">
        {t(clave)}
      </p>
    ) : null;
  };
  const texto = (k: "title" | "schedule" | "vacancies" | "hiring_date" | "required_experience", etiqueta: MessageKey, tipo = "text", deshabilitado = false) => {
    return (
      <div className="campo">
        <label htmlFor={`oferta-${k}`}>{t(etiqueta)}</label>
        <input
          id={`oferta-${k}`}
          type={tipo}
          min={tipo === "number" ? (k === "vacancies" ? 1 : 0) : undefined}
          value={form[k]}
          disabled={bloqueado(k) || deshabilitado}
          aria-invalid={Boolean(errores[k])}
          aria-describedby={describir(k)}
          onChange={(ev) => set(k, ev.target.value)}
        />
        {errorDe(k)}
      </div>
    );
  };
  const casilla = (k: "is_confidential" | "is_experience_required" | "required_availability_to_travel", etiqueta: MessageKey, ayuda?: string) => {
    return (
      <div className="casilla">
        <input id={`oferta-${k}`} type="checkbox" checked={form[k]} disabled={bloqueado(k)} aria-describedby={ayuda} onChange={(ev) => set(k, ev.target.checked)} />
        <label htmlFor={`oferta-${k}`}>{t(etiqueta)}</label>
      </div>
    );
  };
  const selector = (k: keyof OfferForm & keyof OfferInput, etiqueta: MessageKey, lista: CatalogRef[], deshabilitado = false, ayuda?: string) => {
    return (
      <div className="campo" key={k}>
        <label htmlFor={`oferta-${k}`}>{t(etiqueta)}</label>
        <select id={`oferta-${k}`} value={form[k] as string} disabled={bloqueado(k) || deshabilitado} aria-describedby={ayuda} onChange={(ev) => set(k, ev.target.value as never)}>
          <option value="">{t("offerForm.none")}</option>
          {lista.map((c) => (
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
      {encabezado}
      <p className="enlaces">
        <Link href="/company/offers">{t("offerForm.backToList")}</Link>
        {detalle ? (
          <Link
            href={`/company/offers/${detalle.id}/applications`}
            aria-label={detalle.applications_count === 1 ? tf("companyOffers.applicationsOne", { title: detalle.title }) : tf("companyOffers.applications", { n: detalle.applications_count, title: detalle.title })}
          >
            {detalle.applications_count === 1 ? t("companyOffers.countOne") : tf("companyOffers.count", { n: detalle.applications_count })}
          </Link>
        ) : null}
      </p>
      {detalle ? <p className="etiqueta-estado">{tf("offerForm.statusLine", { status: offerStatusLabel(detalle.status) })}</p> : null}
      {cerrada ? <p className="aviso">{t("offerForm.closedNotice")}</p> : null}
      {!cerrada && detalle && detalle.applications_count > 0 ? <p className="aviso">{t("offerForm.frozen")}</p> : null}
      {aviso ? (
        <p className="formulario__aviso" role="status">
          {t(aviso)}
        </p>
      ) : null}
      {error ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}

      <form method="post" className="formulario" aria-label={t(id ? "offerForm.titleEdit" : "offerForm.titleNew")} noValidate onSubmit={(ev) => void guardar(ev)}>
        {hayErrores ? (
          <p className="formulario__error" role="alert">
            {t("offerForm.error.summary")}
          </p>
        ) : null}
        <fieldset className="opciones">
          <legend>{t("offerForm.group.basics")}</legend>
          {texto("title", "offerForm.field.title")}
          <div className="campo">
            <label htmlFor="oferta-description">{t("offerForm.field.description")}</label>
            <textarea
              id="oferta-description"
              rows={6}
              value={form.description}
              disabled={bloqueado("description")}
              aria-invalid={Boolean(errores.description)}
              aria-describedby={describir("description", "oferta-description-ayuda")}
              onChange={(ev) => set("description", ev.target.value)}
            />
            <p id="oferta-description-ayuda" className="campo__ayuda">
              {t("offerForm.help.description")}
            </p>
            {errorDe("description")}
          </div>
          {casilla("is_confidential", "offerForm.field.confidential", detalle?.publication_date && detalle.applications_count === 0 ? "oferta-confidencial-fija" : undefined)}
          {detalle?.publication_date && detalle.applications_count === 0 ? (
            <p id="oferta-confidencial-fija" className="campo__ayuda">
              {t("offerForm.confidentialLocked")}
            </p>
          ) : null}
          {form.is_confidential ? <p className="formulario__aviso">{t("offerForm.confidentialNotice")}</p> : null}
        </fieldset>

        <fieldset className="opciones">
          <legend>{t("offerForm.group.conditions")}</legend>
          {SELECTORES.map((s) => selector(s.campo, s.etiqueta, catalogos[s.catalogo] ?? []))}
          {texto("schedule", "offerForm.field.schedule")}
          {texto("vacancies", "offerForm.field.vacancies", "number")}
          {texto("hiring_date", "offerForm.field.hiringDate", "date")}
          {casilla("required_availability_to_travel", "offerForm.field.travel")}
        </fieldset>

        <fieldset className="opciones">
          <legend>{t("offerForm.group.place")}</legend>
          {selector("state_id", "offerForm.field.state", catalogos.states ?? [])}
          {selector("city_id", "offerForm.field.city", municipios, !estado, !estado ? "oferta-ciudad-ayuda" : undefined)}
          {!estado ? (
            <p id="oferta-ciudad-ayuda" className="campo__ayuda">
              {t("offerForm.help.cityFirst")}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="opciones">
          <legend>{t("offerForm.group.requirements")}</legend>
          {casilla("is_experience_required", "offerForm.field.experienceRequired")}
          {texto("required_experience", "offerForm.field.experience", "number", !form.is_experience_required)}

          <h2 className="subtitulo">{t("offerForm.skills.title")}</h2>
          {errorDe("skills")}
          {form.skills.length === 0 ? <p className="campo__ayuda">{t("offerForm.skills.empty")}</p> : null}
          <ul className="lista">
            {form.skills.map((s, i) => {
              const nombre = nombreDe("skills", s.skill_id);
              return (
                <li key={s.skill_id} className="tarjeta tarjeta--fila">
                  <strong>{nombre}</strong>
                  <span className="casilla">
                    <input
                      id={`oferta-skill-${i}-obligatoria`}
                      type="checkbox"
                      checked={s.is_required}
                      disabled={bloqueado("skills")}
                      onChange={(ev) => set("skills", form.skills.map((x, j) => (j === i ? { ...x, is_required: ev.target.checked } : x)))}
                    />
                    <label htmlFor={`oferta-skill-${i}-obligatoria`}>{tf("offerForm.skills.required", { name: nombre })}</label>
                  </span>
                  <label className="solo-lectores" htmlFor={`oferta-skill-${i}-nivel`}>
                    {tf("offerForm.skills.level", { name: nombre })}
                  </label>
                  <select
                    id={`oferta-skill-${i}-nivel`}
                    value={s.min_level}
                    disabled={bloqueado("skills")}
                    onChange={(ev) => set("skills", form.skills.map((x, j) => (j === i ? { ...x, min_level: ev.target.value } : x)))}
                  >
                    <option value="">{t("offerForm.skills.anyLevel")}</option>
                    {NIVELES.map((n) => (
                      <option key={n} value={n}>
                        {t(`form.level.${n}`)}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="boton boton--borde" disabled={bloqueado("skills")} onClick={() => set("skills", form.skills.filter((_, j) => j !== i))}>
                    {tf("offerForm.skills.remove", { name: nombre })}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="tarjeta--fila">
            <div className="campo">
              <label htmlFor="oferta-skill-elegir">{t("offerForm.skills.pick")}</label>
              <select id="oferta-skill-elegir" value={skill} disabled={bloqueado("skills")} onChange={(ev) => setSkill(ev.target.value)}>
                <option value="">{t("offerForm.none")}</option>
                {(catalogos.skills ?? [])
                  .filter((c) => !form.skills.some((s) => s.skill_id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              className="boton boton--borde"
              disabled={bloqueado("skills") || !skill}
              onClick={() => {
                set("skills", [...form.skills, { skill_id: skill, is_required: true, min_level: "" }]);
                setSkill("");
              }}
            >
              {t("offerForm.skills.add")}
            </button>
          </div>

          <h2 className="subtitulo">{t("offerForm.languages.title")}</h2>
          {errorDe("languages")}
          {form.languages.length === 0 ? <p className="campo__ayuda">{t("offerForm.languages.empty")}</p> : null}
          <ul className="lista">
            {form.languages.map((l, i) => {
              const nombre = nombreDe("languages", l.language_id);
              return (
                <li key={l.language_id} className="tarjeta tarjeta--fila">
                  <strong>{nombre}</strong>
                  <label className="solo-lectores" htmlFor={`oferta-idioma-${i}-nivel`}>
                    {tf("offerForm.languages.level", { name: nombre })}
                  </label>
                  <select
                    id={`oferta-idioma-${i}-nivel`}
                    value={l.min_proficiency}
                    disabled={bloqueado("languages")}
                    onChange={(ev) => set("languages", form.languages.map((x, j) => (j === i ? { ...x, min_proficiency: ev.target.value } : x)))}
                  >
                    <option value="">{t("offerForm.skills.anyLevel")}</option>
                    {DOMINIOS.map((n) => (
                      <option key={n} value={n}>
                        {t(`form.proficiency.${n}`)}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="boton boton--borde" disabled={bloqueado("languages")} onClick={() => set("languages", form.languages.filter((_, j) => j !== i))}>
                    {tf("offerForm.languages.remove", { name: nombre })}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="tarjeta--fila">
            <div className="campo">
              <label htmlFor="oferta-idioma-elegir">{t("offerForm.languages.pick")}</label>
              <select id="oferta-idioma-elegir" value={idioma} disabled={bloqueado("languages")} onChange={(ev) => setIdioma(ev.target.value)}>
                <option value="">{t("offerForm.none")}</option>
                {(catalogos.languages ?? [])
                  .filter((c) => !form.languages.some((l) => l.language_id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              className="boton boton--borde"
              disabled={bloqueado("languages") || !idioma}
              onClick={() => {
                set("languages", [...form.languages, { language_id: idioma, min_proficiency: "" }]);
                setIdioma("");
              }}
            >
              {t("offerForm.languages.add")}
            </button>
          </div>

          <fieldset className="opciones">
            <legend>{t("offerForm.licenses")}</legend>
            {errorDe("driver_license_ids")}
            {(catalogos["driver-licenses"] ?? []).map((d) => (
              <div className="casilla" key={d.id}>
                <input
                  id={`oferta-licencia-${d.id}`}
                  type="checkbox"
                  checked={form.driver_license_ids.includes(d.id)}
                  disabled={bloqueado("driver_license_ids")}
                  onChange={(ev) => set("driver_license_ids", ev.target.checked ? [...form.driver_license_ids, d.id] : form.driver_license_ids.filter((x) => x !== d.id))}
                />
                <label htmlFor={`oferta-licencia-${d.id}`}>{d.name}</label>
              </div>
            ))}
          </fieldset>
        </fieldset>

        {cerrada ? null : (
          <div className="acciones acciones--juntas">
            <button type="submit" className="boton boton--coral" disabled={trabajando} aria-busy={trabajando}>
              {trabajando ? t("offerForm.saving") : t(id ? "offerForm.save" : "offerForm.create")}
            </button>
          </div>
        )}
      </form>

      {detalle && acciones ? (
        <section aria-labelledby="oferta-acciones" className="grupo">
          <h2 id="oferta-acciones">{t("offerForm.actions")}</h2>
          <div className="acciones acciones--juntas">
            {acciones.publish ? (
              <button type="button" className="boton boton--coral" disabled={trabajando || motivo !== null} aria-describedby={motivo ? "oferta-motivo" : undefined} onClick={() => void transicion("publish")}>
                {t("offerForm.publish")}
              </button>
            ) : null}
            {acciones.pause ? (
              <button type="button" className="boton boton--borde" disabled={trabajando} onClick={() => void transicion("pause")}>
                {t("offerForm.pause")}
              </button>
            ) : null}
            {acciones.close ? (
              <button
                type="button"
                className="boton boton--peligro"
                disabled={trabajando}
                onClick={(ev) => {
                  disparador.current = ev.currentTarget;
                  setDialogo("close");
                }}
              >
                {t("offerForm.close")}
              </button>
            ) : null}
            {acciones.remove ? (
              <button
                type="button"
                className="boton boton--peligro"
                disabled={trabajando}
                onClick={(ev) => {
                  disparador.current = ev.currentTarget;
                  setDialogo("remove");
                }}
              >
                {t("offerForm.delete")}
              </button>
            ) : null}
          </div>
          {acciones.publish && motivo ? (
            <p id="oferta-motivo" className="campo__ayuda">
              {motivo}
            </p>
          ) : null}
        </section>
      ) : null}

      {dialogo === "close" ? (
        <ConfirmDialog
          titleKey="offerForm.closeDialog.title"
          confirmKey="offerForm.closeDialog.confirm"
          workingKey="offerForm.closeDialog.working"
          cancelKey="offerForm.closeDialog.cancel"
          working={trabajando}
          errorText={error}
          onConfirm={() => void transicion("close")}
          onCancel={cerrarDialogo}
        >
          <p>{t("offerForm.closeDialog.warning")}</p>
        </ConfirmDialog>
      ) : null}
      {dialogo === "remove" ? (
        <ConfirmDialog
          titleKey="offerForm.deleteDialog.title"
          confirmKey="offerForm.deleteDialog.confirm"
          workingKey="offerForm.deleteDialog.working"
          cancelKey="offerForm.deleteDialog.cancel"
          working={trabajando}
          errorText={error}
          onConfirm={() => void borrar()}
          onCancel={cerrarDialogo}
        >
          <p>{t("offerForm.deleteDialog.warning")}</p>
        </ConfirmDialog>
      ) : null}
    </main>
  );
}
