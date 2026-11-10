"use client";

import { useEffect, useRef, useState } from "react";
import { t, type MessageKey } from "@/lib/messages";
import {
  LEVELS,
  PROFICIENCIES,
  blankExperience,
  blankLanguage,
  fieldId,
  languageMissing,
  patchWhere,
  suggestSkills,
  toPayload,
  validate,
  withField,
  type Catalogs,
  type FieldErrors,
  type FormLang,
  type FormSkill,
  type FormState,
  type SubmitHandler,
} from "@/lib/cv/form";
import type { Confianza } from "@/lib/cv/types";

interface Props {
  initial: FormState;
  catalogs: Catalogs;
  /** "confirm": revisión de un CV (sin teléfono ni datos de perfil). "profile": perfil completo. */
  mode: "confirm" | "profile";
  submitLabel: MessageKey;
  busyLabel: MessageKey;
  onSubmit: SubmitHandler;
}

function Confianza({ valor }: { valor?: Confianza }) {
  if (!valor) return null;
  return (
    <>
      <span className={`confianza confianza--${valor}`}>{t(`confidence.${valor}`)}</span>
      {valor === "baja" ? <span className="campo__ayuda">{t("confidence.baja.hint")}</span> : null}
    </>
  );
}

function CampoSelect({ id, clave, lista, value, onChange }: { id: string; clave: MessageKey; lista: Catalogs["academic"]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{t(clave)}</label>
      <select id={id} value={value} onChange={(ev) => onChange(ev.target.value)}>
        <option value="">{t("form.select.none")}</option>
        {lista.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ProfileForm({ initial, catalogs, mode, submitLabel, busyLabel, onSubmit }: Props) {
  const [f, setF] = useState(initial);
  const [errs, setErrs] = useState([] as FieldErrors);
  const [focusId, setFocusId] = useState(null as string | null);
  const [serverError, setServerError] = useState(null as MessageKey | null);
  const [notice, setNotice] = useState(null as MessageKey | null);
  const [busy, setBusy] = useState(false);
  const enVuelo = useRef(false);
  const [query, setQuery] = useState("");
  const conPerfil = mode === "profile";

  useEffect(() => {
    if (focusId) document.getElementById(focusId)?.focus();
  }, [focusId, errs]);

  const set = (k: keyof FormState, v: FormState[keyof FormState]) => setF((s) => withField(s, k, v as never));
  const errDe = (id: string) => errs.find((e) => e.id === id)?.key;
  const campoErr = (id: string) => {
    const e = errDe(id);
    return {
      id,
      "aria-invalid": e ? (true as const) : undefined,
      "aria-describedby": e ? `${id}-error` : undefined,
    };
  };
  const mensajeErr = (id: string) => {
    const e = errDe(id);
    return e ? (
      <p className="campo__error" id={`${id}-error`}>
        {t(e)}
      </p>
    ) : null;
  };

  async function enviar(ev: { preventDefault(): void }) {
    ev.preventDefault();
    if (enVuelo.current) return;
    setNotice(null);
    setServerError(null);
    const problemas = validate(f, conPerfil);
    if (problemas.length) {
      setErrs(problemas);
      setFocusId(problemas[0].id);
      return;
    }
    setErrs([]);
    setFocusId(null);
    enVuelo.current = true;
    setBusy(true);
    let r;
    try {
      r = await onSubmit(toPayload(f, conPerfil));
    } catch {
      r = { error: "cv.error.generic" as MessageKey };
    }
    if (r && "done" in r) return; // la navegación sigue en curso: el botón queda deshabilitado
    if (r && "error" in r) setServerError(r.error);
    if (r && "notice" in r) setNotice(r.notice);
    enVuelo.current = false;
    setBusy(false);
  }

  const sugerencias = suggestSkills(catalogs.skills, f.skills, query);
  const addSkill = (id: string) => {
    const item = catalogs.skills.find((c) => c.id === id);
    if (!item) return;
    set("skills", [...f.skills, { skill_id: item.id, name: item.name, level: null, years: null }]);
    setQuery("");
  };
  const teclaBusqueda = (ev: { key: string; preventDefault(): void }) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    if (query.trim() && sugerencias[0]) addSkill(sugerencias[0].id);
  };
  function upSkill(id: string, patch: object) {
    set("skills", patchWhere(f.skills, (s) => s.skill_id === id, patch));
  }
  function upLang(key: string, patch: object) {
    set("languages", patchWhere(f.languages, (l) => l.key === key, patch));
  }
  function upExp(key: string, patch: object) {
    set("experiences", patchWhere(f.experiences, (e) => e.key === key, patch));
  }

  const mensaje = serverError ? t(serverError) : errs.length ? t("form.error.summary") : null;

  return (
    <form method="post" className="formulario" noValidate onSubmit={enviar}>
      <div className="campo">
        <label htmlFor={fieldId("description")}>{t("form.description")}</label>
        <textarea {...campoErr(fieldId("description"))} rows={4} value={f.description} onChange={(ev) => set("description", ev.target.value)} />
        {mensajeErr(fieldId("description"))}
      </div>

      {conPerfil ? (
        <>
          <div className="campo">
            <label htmlFor={fieldId("phone")}>{t("form.phone")}</label>
            <input {...campoErr(fieldId("phone"))} type="tel" autoComplete="tel" value={f.phone} onChange={(ev) => set("phone", ev.target.value)} aria-describedby={errDe(fieldId("phone")) ? `${fieldId("phone")}-error` : `${fieldId("phone")}-ayuda`} />
            <p className="campo__ayuda" id={`${fieldId("phone")}-ayuda`}>
              {t("form.phone.help")}
            </p>
            {mensajeErr(fieldId("phone"))}
          </div>
          <CampoSelect id={fieldId("academic")} clave="form.academic" lista={catalogs.academic} value={f.academic_level_id} onChange={(v) => set("academic_level_id", v)} />
          <CampoSelect id={fieldId("profession")} clave="form.profession" lista={catalogs.professions} value={f.profession_id} onChange={(v) => set("profession_id", v)} />
          <CampoSelect id={fieldId("hierarchy")} clave="form.hierarchy" lista={catalogs.hierarchies} value={f.job_hierarchy_id} onChange={(v) => set("job_hierarchy_id", v)} />
        </>
      ) : null}

      <section aria-labelledby="g-exp" className="grupo">
        <h2 id="g-exp">{t("form.group.experience")}</h2>
        {f.experiences.length === 0 ? <p className="campo__ayuda">{t("form.exp.empty")}</p> : null}
        <ul className="lista">
          {f.experiences.map((e, i) => (
            <li key={e.key} data-destacado={e.confidence === "baja" ? "true" : undefined} className="tarjeta">
              <Confianza valor={e.confidence} />
              <div className="campo">
                <label htmlFor={fieldId(e.key, "company")}>{t("form.exp.company")}</label>
                <input {...campoErr(fieldId(e.key, "company"))} value={e.company} onChange={(ev) => upExp(e.key, { company: ev.target.value })} />
                {mensajeErr(fieldId(e.key, "company"))}
              </div>
              <div className="campo">
                <label htmlFor={fieldId(e.key, "title")}>{t("form.exp.title")}</label>
                <input {...campoErr(fieldId(e.key, "title"))} value={e.title} onChange={(ev) => upExp(e.key, { title: ev.target.value })} />
                {mensajeErr(fieldId(e.key, "title"))}
              </div>
              <div className="campo">
                <label htmlFor={fieldId(e.key, "start")}>{t("form.exp.start")}</label>
                <input {...campoErr(fieldId(e.key, "start"))} type="date" value={e.start_date} onChange={(ev) => upExp(e.key, { start_date: ev.target.value })} />
                {mensajeErr(fieldId(e.key, "start"))}
              </div>
              <div className="campo">
                <label htmlFor={fieldId(e.key, "end")}>{t("form.exp.end")}</label>
                <input
                  {...campoErr(fieldId(e.key, "end"))}
                  type="date"
                  value={e.end_date}
                  onChange={(ev) => upExp(e.key, { end_date: ev.target.value })}
                  aria-describedby={errDe(fieldId(e.key, "end")) ? `${fieldId(e.key, "end")}-error` : undefined}
                />
                <p className="campo__ayuda">{t("form.exp.endHelp")}</p>
                {mensajeErr(fieldId(e.key, "end"))}
              </div>
              <div className="campo">
                <label htmlFor={fieldId(e.key, "description")}>{t("form.exp.description")}</label>
                <textarea {...campoErr(fieldId(e.key, "description"))} rows={3} value={e.description} onChange={(ev) => upExp(e.key, { description: ev.target.value })} />
                {mensajeErr(fieldId(e.key, "description"))}
              </div>
              <button type="button" className="boton boton--borde" aria-label={`${t("form.exp.remove")} ${i + 1}`} onClick={() => set("experiences", f.experiences.filter((x) => x.key !== e.key))}>
                {t("form.exp.remove")}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="boton boton--borde" onClick={() => set("experiences", [...f.experiences, blankExperience()])}>
          {t("form.exp.add")}
        </button>
      </section>

      <section aria-labelledby="g-skills" className="grupo">
        <h2 id="g-skills">{t("form.group.skills")}</h2>
        {f.skills.length === 0 ? <p className="campo__ayuda">{t("form.skill.empty")}</p> : null}
        <ul className="lista">
          {f.skills.map((s) => (
            <li key={s.skill_id} data-destacado={s.confidence === "baja" ? "true" : undefined} className="tarjeta tarjeta--fila">
              <strong>{s.name}</strong>
              <Confianza valor={s.confidence} />
              <select aria-label={`${t("form.skill.level")} ${s.name}`} value={s.level ?? ""} onChange={(ev) => upSkill(s.skill_id, { level: (ev.target.value || null) as FormSkill["level"] })}>
                <option value="">{t("form.level.none")}</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`form.level.${l}`)}
                  </option>
                ))}
              </select>
              <button type="button" className="boton boton--borde" aria-label={`${t("form.skill.remove")} ${s.name}`} onClick={() => set("skills", f.skills.filter((x) => x.skill_id !== s.skill_id))}>
                {t("form.skill.remove")}
              </button>
            </li>
          ))}
        </ul>
        <div className="campo">
          <label htmlFor="f-skill-search">{t("form.skill.search")}</label>
          <input id="f-skill-search" type="search" autoComplete="off" value={query} onChange={(ev) => setQuery(ev.target.value)} onKeyDown={teclaBusqueda} aria-describedby="f-skill-sugerencias" />
        </div>
        <div id="f-skill-sugerencias" aria-live="polite">
          {sugerencias.length === 0 && query.trim() ? (
            <p className="campo__ayuda">{t("form.skill.none")}</p>
          ) : (
            <>
              <p className="campo__ayuda">{t("form.skill.suggestions")}</p>
              <ul className="sugerencias">
                {sugerencias.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="boton boton--borde" aria-label={`${t("form.skill.add")} ${c.name}`} onClick={() => addSkill(c.id)}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="g-lang" className="grupo">
        <h2 id="g-lang">{t("form.group.languages")}</h2>
        {f.languages.length === 0 ? <p className="campo__ayuda">{t("form.language.empty")}</p> : null}
        <ul className="lista">
          {f.languages.map((l, i) => (
            <li key={l.key} data-destacado={l.confidence === "baja" ? "true" : undefined} className="tarjeta tarjeta--fila">
              <select
                aria-label={`${t("form.language.select")} ${i + 1}`}
                value={l.language_id}
                onChange={(ev) => upLang(l.key, { language_id: ev.target.value, name: catalogs.languages.find((c) => c.id === ev.target.value)?.name ?? "" })}
              >
                <option value="">{t("form.select.none")}</option>
                {catalogs.languages.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {languageMissing(l, catalogs.languages) ? <option value={l.language_id}>{l.name}</option> : null}
              </select>
              <select aria-label={`${t("form.language.level")} ${i + 1}`} value={l.proficiency} onChange={(ev) => upLang(l.key, { proficiency: ev.target.value as FormLang["proficiency"], to_confirm: false })}>
                {PROFICIENCIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`form.proficiency.${p}`)}
                  </option>
                ))}
              </select>
              <Confianza valor={l.confidence} />
              {l.to_confirm ? <span className="campo__ayuda">{t("review.toConfirm")}</span> : null}
              <button type="button" className="boton boton--borde" aria-label={`${t("form.language.remove")} ${i + 1}`} onClick={() => set("languages", f.languages.filter((x) => x.key !== l.key))}>
                {t("form.language.remove")}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="boton boton--borde" onClick={() => set("languages", [...f.languages, blankLanguage()])}>
          {t("form.language.add")}
        </button>
      </section>

      {mensaje ? (
        <div className="formulario__error" role="alert" aria-live="assertive">
          {mensaje}
        </div>
      ) : null}
      {notice ? (
        <div className="formulario__aviso" role="status">
          {t(notice)}
        </div>
      ) : null}
      <div>
        <button type="submit" className="boton boton--coral" disabled={busy}>
          {busy ? t(busyLabel) : t(submitLabel)}
        </button>
      </div>
    </form>
  );
}
