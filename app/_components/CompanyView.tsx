"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import CompanyGateNotice from "./CompanyGateNotice";
import { companyApi } from "@/lib/company/client";
import { companyErrorText } from "@/lib/company/errors";
import { companyGate, emptyCompanyForm, fromCompany, toCompanyInput, validateCompany, type CompanyErrors, type CompanyForm } from "@/lib/company/rules";
import { COMPANY_ROLES, type Company, type CompanyRole, type Invitation, type Recruiter } from "@/lib/company/types";
import { formatDate } from "@/lib/interviews/format";
import { offersApi } from "@/lib/offers/client";
import { formatDay } from "@/lib/offers/format";
import type { CatalogRef } from "@/lib/offers/types";
import { t, tf, type MessageKey } from "@/lib/messages";

const CAMPOS: (keyof CompanyForm)[] = ["name", "tax_id", "website", "phone", "description", "country_id", "employment_sector_id"];
const ETIQUETA: Record<keyof CompanyForm, MessageKey> = {
  name: "companyForm.field.name",
  tax_id: "companyForm.field.taxId",
  website: "companyForm.field.website",
  phone: "companyForm.field.phone",
  "description": "companyForm.field.description",
  country_id: "companyForm.field.country",
  employment_sector_id: "companyForm.field.sector",
};
const AYUDA: Partial<Record<keyof CompanyForm, MessageKey>> = {
  tax_id: "companyForm.help.taxId",
  website: "companyForm.help.website",
};
const ROL: Record<CompanyRole, MessageKey> = { company_admin: "company.role.company_admin", recruiter: "company.role.recruiter" };
const ESTADO_INVITACION: Record<Invitation["status"], MessageKey> = {
  pending: "company.invitation.status.pending",
  used: "company.invitation.status.used",
  expired: "company.invitation.status.expired",
};

/** Formulario de empresa: crear (POST) o editar (PUT). Los textos de la empresa se editan en campos, nunca como HTML. */
function FormularioEmpresa({ inicial, modo, onListo, onCancelar }: { inicial: CompanyForm; modo: "new" | "edit"; onListo: (c: Company | null) => void; onCancelar?: () => void }) {
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState({} as CompanyErrors);
  const [errorServidor, setErrorServidor] = useState(null as string | null);
  const [enviando, setEnviando] = useState(false);
  const [catalogos, setCatalogos] = useState({ countries: [] as CatalogRef[], sectors: [] as CatalogRef[] });
  const enVuelo = useRef(false);
  const id = `empresa-${modo}`;

  useEffect(() => {
    let vivo = true;
    void Promise.all([offersApi.catalog("countries"), offersApi.catalog("employment-sectors")]).then(([p, s]) => {
      if (vivo) setCatalogos({ countries: p.data ?? [], sectors: s.data ?? [] });
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current) return;
    const errs = validateCompany(f);
    setErrores(errs);
    setErrorServidor(null);
    const primero = CAMPOS.find((c) => errs[c]);
    if (primero) {
      document.getElementById(`${id}-${primero}`)?.focus();
      return;
    }
    enVuelo.current = true;
    setEnviando(true);
    const entrada = toCompanyInput(f);
    const r = modo === "new" ? await companyApi.create(entrada) : await companyApi.update(entrada);
    enVuelo.current = false;
    setEnviando(false);
    if (r.status === 201 || r.status === 204) onListo(r.data);
    else if (r.status !== 401) setErrorServidor(companyErrorText(r));
  }

  const describir = (c: keyof CompanyForm) => [AYUDA[c] ? `${id}-${c}-ayuda` : "", errores[c] ? `${id}-${c}-error` : ""].filter(Boolean).join(" ") || undefined;
  const pie = (c: keyof CompanyForm) => {
    const ayuda = AYUDA[c];
    const error = errores[c];
    return (
      <>
        {ayuda ? (
          <p id={`${id}-${c}-ayuda`} className="campo__ayuda">
            {t(ayuda)}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-${c}-error`} className="campo__error">
            {t(error)}
          </p>
        ) : null}
      </>
    );
  };
  const texto = (c: "name" | "tax_id" | "website" | "phone", tipo = "text") => {
    return (
      <div className="campo" key={c}>
        <label htmlFor={`${id}-${c}`}>{t(ETIQUETA[c])}</label>
        <input id={`${id}-${c}`} type={tipo} value={f[c]} aria-invalid={Boolean(errores[c])} aria-describedby={describir(c)} onChange={(ev) => setF((v) => ({ ...v, [c]: ev.target.value }))} />
        {pie(c)}
      </div>
    );
  };
  const selector = (c: "country_id" | "employment_sector_id", lista: CatalogRef[]) => {
    return (
      <div className="campo" key={c}>
        <label htmlFor={`${id}-${c}`}>{t(ETIQUETA[c])}</label>
        <select id={`${id}-${c}`} value={f[c]} aria-invalid={Boolean(errores[c])} aria-describedby={describir(c)} onChange={(ev) => setF((v) => ({ ...v, [c]: ev.target.value }))}>
          <option value="">{t("companyForm.choose")}</option>
          {lista.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {pie(c)}
      </div>
    );
  };

  const hayErrores = Object.values(errores).some(Boolean);
  return (
    <form method="post" className="formulario" aria-labelledby={`${id}-titulo`} noValidate onSubmit={(ev) => void enviar(ev)}>
      <h2 id={`${id}-titulo`}>{t(modo === "new" ? "companyForm.titleNew" : "companyForm.titleEdit")}</h2>
      {hayErrores ? (
        <p className="formulario__error" role="alert">
          {t("companyForm.error.summary")}
        </p>
      ) : null}
      {errorServidor ? (
        <p className="formulario__error" role="alert">
          {errorServidor}
        </p>
      ) : null}
      {texto("name")}
      {texto("tax_id")}
      {texto("website", "url")}
      {texto("phone", "tel")}
      <div className="campo">
        <label htmlFor={`${id}-description`}>{t(ETIQUETA.description)}</label>
        <textarea id={`${id}-description`} rows={3} value={f.description} aria-invalid={Boolean(errores.description)} aria-describedby={describir("description")} onChange={(ev) => setF((v) => ({ ...v, description: ev.target.value }))} />
        {pie("description")}
      </div>
      {selector("country_id", catalogos.countries)}
      {selector("employment_sector_id", catalogos.sectors)}
      <div className="acciones acciones--juntas">
        <button type="submit" className="boton boton--coral" disabled={enviando} aria-busy={enviando}>
          {enviando ? t("companyForm.saving") : t(modo === "new" ? "companyForm.create" : "companyForm.save")}
        </button>
        {onCancelar ? (
          <button type="button" className="boton boton--borde" onClick={onCancelar} disabled={enviando}>
            {t("companyForm.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** Aceptar una invitación pegando el código que te pasó el admin de la empresa (no viaja en la URL). */
function AceptarInvitacion({ onAceptada }: { onAceptada: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState(null as string | null);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);

  async function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current || codigo.trim() === "") return;
    enVuelo.current = true;
    setEnviando(true);
    setError(null);
    const r = await companyApi.acceptInvitation(codigo.trim());
    enVuelo.current = false;
    setEnviando(false);
    if (r.data) onAceptada();
    else if (r.status !== 401) setError(companyErrorText(r));
  }

  return (
    <form method="post" className="formulario" aria-labelledby="aceptar-titulo" onSubmit={(ev) => void enviar(ev)}>
      <h2 id="aceptar-titulo">{t("company.accept.title")}</h2>
      <p className="campo__ayuda">{t("company.accept.lead")}</p>
      {error ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="campo">
        <label htmlFor="aceptar-codigo">{t("company.accept.token")}</label>
        <input id="aceptar-codigo" type="text" autoComplete="off" spellCheck={false} value={codigo} onChange={(ev) => setCodigo(ev.target.value)} />
      </div>
      <div className="acciones acciones--juntas">
        <button type="submit" className="boton boton--borde" disabled={enviando || codigo.trim() === ""}>
          {t("company.accept.submit")}
        </button>
      </div>
    </form>
  );
}

/** Reclutadores de la empresa (solo el admin). Quitar pide confirmación; el último admin no se puede quitar. */
function Equipo() {
  const [lista, setLista] = useState(null as Recruiter[] | null);
  const [fallo, setFallo] = useState(false);
  const [aQuitar, setAQuitar] = useState(null as Recruiter | null);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState(null as string | null);
  const disparador = useRef(null as HTMLElement | null);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    setFallo(false);
    const r = await companyApi.recruiters({ limit: 50 });
    if (r.data) setLista(r.data.items);
    else if (r.status !== 401) setFallo(true);
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function quitar() {
    if (!aQuitar || enVuelo.current) return;
    enVuelo.current = true;
    setQuitando(true);
    setError(null);
    const r = await companyApi.removeRecruiter(aQuitar.id);
    enVuelo.current = false;
    setQuitando(false);
    if (r.status === 204 || r.status === 404) {
      const id = aQuitar.id;
      setLista((l) => (l ? l.filter((x) => x.id !== id) : l));
      setAQuitar(null);
    } else if (r.status !== 401) {
      setError(companyErrorText(r));
    }
  }

  return (
    <section aria-labelledby="equipo-titulo" className="grupo">
      <h2 id="equipo-titulo">{t("company.team.title")}</h2>
      {fallo ? (
        <p className="formulario__error" role="alert">
          {t("company.team.loadError")}
        </p>
      ) : null}
      {lista === null && !fallo ? <p className="campo__ayuda">{t("company.team.loading")}</p> : null}
      {lista ? (
        <ul className="lista">
          {lista.map((r) => (
            <li key={r.id} className="tarjeta tarjeta--fila">
              <span>
                <strong>{r.display_name}</strong>
                {" · "}
                {t(ROL[r.role] ?? "company.role.recruiter")}
              </span>
              <button
                type="button"
                className="boton boton--peligro"
                aria-label={tf("company.team.removeLabel", { name: r.display_name })}
                onClick={(ev) => {
                  disparador.current = ev.currentTarget;
                  setError(null);
                  setAQuitar(r);
                }}
              >
                {t("company.team.remove")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {aQuitar ? (
        <ConfirmDialog
          titleKey="company.team.remove.title"
          confirmKey="company.team.remove.confirm"
          workingKey="company.team.remove.working"
          cancelKey="company.team.remove.cancel"
          working={quitando}
          errorText={error}
          onConfirm={() => void quitar()}
          onCancel={() => {
            if (enVuelo.current) return;
            setAQuitar(null);
            disparador.current?.focus();
          }}
        >
          <p>
            <strong>{aQuitar.display_name}</strong>
          </p>
          <p>{t("company.team.remove.warning")}</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

/** Invitaciones (solo el admin): el código se muestra una sola vez, con «Copiar». No hay correo en la 5a. */
function Invitaciones() {
  const [lista, setLista] = useState(null as Invitation[] | null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("recruiter" as CompanyRole);
  const [error, setError] = useState(null as string | null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState(null as string | null);
  const [copiado, setCopiado] = useState(false);
  const [aRevocar, setARevocar] = useState(null as Invitation | null);
  const [revocando, setRevocando] = useState(false);
  const [errorRevocar, setErrorRevocar] = useState(null as string | null);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLElement | null);

  const cargar = useCallback(async () => {
    const r = await companyApi.invitations({ limit: 50 });
    if (r.data) setLista(r.data.items);
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function invitar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (enVuelo.current) return;
    if (email.trim() === "") {
      setError(t("company.invite.emailRequired"));
      return;
    }
    enVuelo.current = true;
    setEnviando(true);
    setError(null);
    const r = await companyApi.invite(email.trim(), rol);
    enVuelo.current = false;
    setEnviando(false);
    if (r.data) {
      const nueva = r.data;
      setCodigo(nueva.token ?? null);
      setCopiado(false);
      setEmail("");
      // El token no se guarda en la lista: solo se muestra en este aviso, una vez.
      setLista((l) => [{ id: nueva.id, role: nueva.role, status: nueva.status, expires_at: nueva.expires_at, created_at: nueva.created_at }, ...(l ?? [])]);
    } else if (r.status !== 401) {
      setError(companyErrorText(r));
    }
  }

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  async function revocar() {
    if (!aRevocar || enVuelo.current) return;
    enVuelo.current = true;
    setRevocando(true);
    setErrorRevocar(null);
    const r = await companyApi.revokeInvitation(aRevocar.id);
    enVuelo.current = false;
    setRevocando(false);
    if (r.status === 204 || r.status === 404) {
      const id = aRevocar.id;
      setLista((l) => (l ? l.filter((x) => x.id !== id) : l));
      setARevocar(null);
    } else if (r.status !== 401) {
      setErrorRevocar(companyErrorText(r));
    }
  }

  return (
    <section aria-labelledby="invitar-titulo" className="grupo">
      <h2 id="invitar-titulo">{t("company.invite.title")}</h2>
      <p className="campo__ayuda">{t("company.invite.lead")}</p>
      <form method="post" className="formulario" onSubmit={(ev) => void invitar(ev)} noValidate>
        {error ? (
          <p className="formulario__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="campo">
          <label htmlFor="invitar-email">{t("company.invite.email")}</label>
          <input id="invitar-email" type="email" autoComplete="off" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="invitar-rol">{t("company.invite.role")}</label>
          <select id="invitar-rol" value={rol} onChange={(ev) => setRol(ev.target.value as CompanyRole)}>
            {COMPANY_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROL[r])}
              </option>
            ))}
          </select>
        </div>
        <div className="acciones acciones--juntas">
          <button type="submit" className="boton boton--coral" disabled={enviando} aria-busy={enviando}>
            {t("company.invite.submit")}
          </button>
        </div>
      </form>
      {codigo ? (
        <div className="formulario__aviso" role="status">
          <p>{t("company.invite.tokenOnce")}</p>
          <p>
            <code className="codigo">{codigo}</code>
          </p>
          <div className="acciones acciones--juntas">
            <button type="button" className="boton boton--borde" onClick={() => void copiar()}>
              {t("company.invite.copy")}
            </button>
            <button type="button" className="boton boton--borde" onClick={() => setCodigo(null)}>
              {t("company.invite.done")}
            </button>
          </div>
          {copiado ? <p>{t("company.invite.copied")}</p> : null}
        </div>
      ) : null}
      {lista && lista.length > 0 ? (
        <ul className="lista">
          {lista.map((i) => (
            <li key={i.id} className="tarjeta tarjeta--fila">
              <span>
                {t(ROL[i.role] ?? "company.role.recruiter")}
                {" · "}
                {t(ESTADO_INVITACION[i.status] ?? "company.invitation.status.pending")}
                {" · "}
                {tf("company.invitation.expires", { date: formatDate(i.expires_at) })}
              </span>
              {i.status === "pending" ? (
                <button
                  type="button"
                  className="boton boton--peligro"
                  aria-label={tf("company.invite.revokeLabel", { date: formatDate(i.created_at) })}
                  onClick={(ev) => {
                    disparador.current = ev.currentTarget;
                    setErrorRevocar(null);
                    setARevocar(i);
                  }}
                >
                  {t("company.invite.revoke")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {aRevocar ? (
        <ConfirmDialog
          titleKey="company.invite.revokeTitle"
          confirmKey="company.invite.revokeConfirm"
          workingKey="company.invite.revokeWorking"
          cancelKey="company.invite.revokeCancel"
          working={revocando}
          errorText={errorRevocar}
          onConfirm={() => void revocar()}
          onCancel={() => {
            if (enVuelo.current) return;
            setARevocar(null);
            disparador.current?.focus();
          }}
        >
          <p>{t("company.invite.revokeWarning")}</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

/** /company: crear la empresa o aceptar una invitación; o ver su estado (FC8), sus datos y, si eres admin, el equipo. */
export default function CompanyView() {
  const [empresa, setEmpresa] = useState(undefined as Company | null | undefined);
  const [fallo, setFallo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState(null as MessageKey | null);

  const cargar = useCallback(async () => {
    setFallo(false);
    const r = await companyApi.get();
    if (r.data) setEmpresa(r.data);
    else if (r.status === 404) setEmpresa(null);
    else if (r.status !== 401) setFallo(true);
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const encabezado = (
    <>
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("company.title")}</h1>
    </>
  );

  if (fallo) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="formulario__error" role="alert">
          {t("company.loadError")}
        </p>
        <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
          {t("company.retry")}
        </button>
      </main>
    );
  }
  if (empresa === undefined) {
    return (
      <main className="pagina" aria-busy="true">
        {encabezado}
        <p role="status">{t("company.loading")}</p>
      </main>
    );
  }
  if (empresa === null) {
    return (
      <main className="pagina">
        {encabezado}
        <p className="eslogan">{t("company.none.lead")}</p>
        <FormularioEmpresa
          inicial={emptyCompanyForm()}
          modo="new"
          onListo={(c) => {
            if (c) setEmpresa(c);
            else void cargar();
          }}
        />
        <AceptarInvitacion onAceptada={() => void cargar()} />
        <p>
          <Link href="/dashboard">{t("offers.back")}</Link>
        </p>
      </main>
    );
  }

  const admin = empresa.my_role === "company_admin";
  const datos: [MessageKey, string | null][] = [
    ["companyForm.field.taxId", empresa.tax_id],
    ["companyForm.field.website", empresa.website],
    ["companyForm.field.phone", empresa.phone],
    ["company.myRole", t(ROL[empresa.my_role] ?? "company.role.recruiter")],
    ["company.membership", empresa.membership ? tf("company.membershipDates", { start: formatDay(empresa.membership.start_date), end: formatDay(empresa.membership.expiration_date) }) : null],
  ];
  return (
    <main className="pagina">
      {encabezado}
      <p className="enlaces">
        <Link href="/company/offers">{t("company.toOffers")}</Link>
        <Link href="/dashboard">{t("offers.back")}</Link>
      </p>
      <CompanyGateNotice gate={companyGate(empresa)} />
      {aviso ? (
        <p className="formulario__aviso" role="status">
          {t(aviso)}
        </p>
      ) : null}
      {editando ? (
        <FormularioEmpresa
          inicial={fromCompany(empresa)}
          modo="edit"
          onCancelar={() => setEditando(false)}
          onListo={() => {
            setEditando(false);
            setAviso("companyForm.saved");
            void cargar();
          }}
        />
      ) : (
        <section aria-labelledby="empresa-nombre" className="grupo">
          <h2 id="empresa-nombre">{empresa.name}</h2>
          <dl className="ficha">
            {datos
              .filter((d): d is [MessageKey, string] => Boolean(d[1]))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{t(k)}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {empresa.description ? <p className="texto-libre">{empresa.description}</p> : null}
          {admin ? (
            <p>
              <button
                type="button"
                className="boton boton--borde"
                onClick={() => {
                  setAviso(null);
                  setEditando(true);
                }}
              >
                {t("company.edit")}
              </button>
            </p>
          ) : null}
        </section>
      )}
      {admin ? <Equipo /> : null}
      {admin ? <Invitaciones /> : null}
    </main>
  );
}
