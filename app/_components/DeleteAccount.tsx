"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { goTo } from "@/lib/navigate";
import { t, type MessageKey } from "@/lib/messages";

export default function DeleteAccount() {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null as MessageKey | null);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  const disparador = useRef(null as HTMLButtonElement | null);
  const campo = useRef(null as HTMLInputElement | null);
  const dialogo = useRef(null as HTMLDivElement | null);

  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  function cerrar() {
    if (enVuelo.current) return;
    setAbierto(false);
    setClave("");
    setError(null);
    disparador.current?.focus();
  }

  async function confirmar() {
    if (enVuelo.current || !clave) return;
    enVuelo.current = true;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: clave }),
      });
      if (res.status === 204 || res.ok) {
        goTo("/adios");
        return;
      }
      setError(res.status === 403 ? "account.delete.wrongPassword" : "account.delete.failed");
    } catch {
      setError("account.delete.failed");
    }
    enVuelo.current = false;
    setEnviando(false);
  }

  /** Escape cierra; Tab queda atrapado dentro del diálogo. */
  function teclas(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      cerrar();
      return;
    }
    if (ev.key !== "Tab" || !dialogo.current) return;
    const items = (Array.from(dialogo.current.querySelectorAll("input, button")) as HTMLButtonElement[]).filter((el) => !el.disabled);
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

  return (
    <>
      <button type="button" ref={disparador} className="boton boton--peligro" onClick={() => setAbierto(true)}>
        {t("account.delete.open")}
      </button>
      {abierto ? (
        <div className="velo">
          <div
            ref={dialogo}
            className="dialogo"
            role="dialog"
            aria-modal="true"
            aria-labelledby="borrar-titulo"
            aria-describedby="borrar-detalle"
            onKeyDown={teclas}
          >
            <h2 id="borrar-titulo">{t("account.delete.title")}</h2>
            <div id="borrar-detalle">
              <p>{t("account.delete.warning")}</p>
              <ul>
                <li>{t("account.delete.lossProfile")}</li>
                <li>{t("account.delete.lossHistory")}</li>
              </ul>
              <p>
                <strong>{t("account.delete.irreversible")}</strong>
              </p>
            </div>
            <div className="campo">
              <label htmlFor="borrar-clave">{t("auth.field.password")}</label>
              <input
                id="borrar-clave"
                ref={campo}
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(ev) => setClave(ev.target.value)}
                aria-describedby="borrar-ayuda"
                disabled={enviando}
              />
              <p className="campo__ayuda" id="borrar-ayuda">
                {t("account.delete.passwordHelp")}
              </p>
            </div>
            <div className="formulario__error" role="alert" aria-live="assertive">
              {error ? t(error) : null}
            </div>
            <div className="dialogo__acciones">
              <button type="button" className="boton boton--borde" onClick={cerrar} disabled={enviando}>
                {t("account.delete.cancel")}
              </button>
              <button type="button" className="boton boton--peligro" onClick={confirmar} disabled={!clave || enviando}>
                {enviando ? t("account.delete.working") : t("account.delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
