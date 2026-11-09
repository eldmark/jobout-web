"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { t, type MessageKey } from "@/lib/messages";

interface Props {
  titleKey: MessageKey;
  confirmKey: MessageKey;
  workingKey: MessageKey;
  cancelKey: MessageKey;
  working: boolean;
  error: MessageKey | null;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/** Diálogo modal accesible: rol, nombre, Escape, trampa de foco. El foco inicial va a «Cancelar». */
export default function ConfirmDialog({ titleKey, confirmKey, workingKey, cancelKey, working, error, onConfirm, onCancel, children }: Props) {
  const cancelar = useRef(null as HTMLButtonElement | null);
  const dialogo = useRef(null as HTMLDivElement | null);

  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  function teclas(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      if (!working) onCancel();
      return;
    }
    if (ev.key !== "Tab" || !dialogo.current) return;
    const items = (Array.from(dialogo.current.querySelectorAll("button")) as HTMLButtonElement[]).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (ev.shiftKey && (document.activeElement === primero || !dialogo.current.contains(document.activeElement))) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (document.activeElement === ultimo || !dialogo.current.contains(document.activeElement))) {
      ev.preventDefault();
      primero.focus();
    }
  }

  return (
    <div className="velo">
      <div ref={dialogo} className="dialogo" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-detalle" onKeyDown={teclas}>
        <h2 id="dlg-titulo">{t(titleKey)}</h2>
        <div id="dlg-detalle">{children}</div>
        {error ? (
          <div className="formulario__error" role="alert" aria-live="assertive">
            {t(error)}
          </div>
        ) : null}
        <div className="dialogo__acciones">
          <button type="button" ref={cancelar} className="boton boton--borde" onClick={onCancel} disabled={working}>
            {t(cancelKey)}
          </button>
          <button type="button" className="boton boton--peligro" onClick={onConfirm} disabled={working}>
            {working ? t(workingKey) : t(confirmKey)}
          </button>
        </div>
      </div>
    </div>
  );
}
