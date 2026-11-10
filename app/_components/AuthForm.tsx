"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { EMAIL_RE, authErrorKey, type AuthForm as Kind, type Campo, type ErroresCampo, type ValoresCampo } from "@/lib/auth/errors";
import { goTo } from "@/lib/navigate";
import { t, type MessageKey } from "@/lib/messages";

const ETIQUETA: Record<Campo, MessageKey> = {
  first_name: "auth.field.firstName",
  last_name: "auth.field.lastName",
  email: "auth.field.email",
  password: "auth.field.password",
};

function validar(kind: Kind, v: ValoresCampo): ErroresCampo {
  const e: ErroresCampo = {};
  if (kind === "register") {
    if (!v.first_name.trim()) e.first_name = "auth.validation.required";
    if (!v.last_name.trim()) e.last_name = "auth.validation.required";
  }
  if (!v.email.trim()) e.email = "auth.validation.required";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "auth.validation.email";
  if (!v.password) e.password = "auth.validation.required";
  else if (kind === "register" && v.password.length < 10) e.password = "auth.validation.passwordShort";
  else if (kind === "register" && v.password.length > 128) e.password = "auth.validation.passwordLong";
  return e;
}

export default function AuthForm({ kind }: { kind: Kind }) {
  const registro = kind === "register";
  const campos: Campo[] = registro ? ["first_name", "last_name", "email", "password"] : ["email", "password"];
  const [valores, setValores] = useState({ first_name: "", last_name: "", email: "", password: "" } as ValoresCampo);
  const [errores, setErrores] = useState({} as ErroresCampo);
  const [errorGeneral, setErrorGeneral] = useState(null as MessageKey | null);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  const refs = useRef({} as Partial<Record<Campo, HTMLInputElement | null>>);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (enVuelo.current) return;
    setErrorGeneral(null);
    const e = validar(kind, valores);
    setErrores(e);
    const primero = campos.find((c) => e[c]);
    if (primero) {
      refs.current[primero]?.focus();
      return;
    }
    enVuelo.current = true;
    setEnviando(true);
    try {
      const cuerpo = registro
        ? { email: valores.email.trim(), password: valores.password, first_name: valores.first_name.trim(), last_name: valores.last_name.trim() }
        : { email: valores.email.trim(), password: valores.password };
      const res = await fetch(registro ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (res.ok) {
        goTo("/dashboard");
        return; // se queda «enviando» mientras el navegador cambia de página
      }
      setErrorGeneral(authErrorKey(res.status, kind));
    } catch {
      setErrorGeneral("auth.error.generic");
    }
    enVuelo.current = false;
    setEnviando(false);
  }

  return (
    <form method="post" className="formulario" onSubmit={enviar} noValidate>
      <div className="formulario__error" role="alert" aria-live="assertive">
        {errorGeneral ? t(errorGeneral) : null}
      </div>
      {campos.map((c) => {
        const id = `campo-${c}`;
        const err = errores[c];
        const ayuda = registro && c === "password";
        const describe = [err ? `${id}-error` : "", ayuda ? `${id}-ayuda` : ""].filter(Boolean).join(" ");
        return (
          <div className="campo" key={c}>
            <label htmlFor={id}>{t(ETIQUETA[c])}</label>
            <input
              id={id}
              ref={(el) => {
                refs.current[c] = el;
              }}
              name={c}
              type={c === "password" ? "password" : c === "email" ? "email" : "text"}
              autoComplete={
                c === "email" ? "email" : c === "password" ? (registro ? "new-password" : "current-password") : c === "first_name" ? "given-name" : "family-name"
              }
              value={valores[c]}
              onChange={(ev) => setValores((v) => ({ ...v, [c]: ev.target.value }))}
              aria-invalid={err ? true : undefined}
              aria-describedby={describe || undefined}
              disabled={enviando}
            />
            {ayuda ? (
              <p className="campo__ayuda" id={`${id}-ayuda`}>
                {t("auth.field.passwordHint")}
              </p>
            ) : null}
            {err ? (
              <p className="campo__error" id={`${id}-error`}>
                {t(err)}
              </p>
            ) : null}
          </div>
        );
      })}
      <button className="boton boton--coral" type="submit" disabled={enviando} aria-busy={enviando}>
        {enviando ? t("auth.submitting") : t(registro ? "auth.signUp.submit" : "auth.signIn.submit")}
      </button>
      <p className="formulario__pie">
        <Link href={registro ? "/sign-in" : "/sign-up"}>{t(registro ? "auth.link.toSignIn" : "auth.link.toSignUp")}</Link>
      </p>
    </form>
  );
}
