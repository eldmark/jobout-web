"use client";

import { useRef, useState } from "react";
import { goTo } from "@/lib/navigate";
import { t } from "@/lib/messages";

export default function LogoutButton() {
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  async function salir() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Si falla la red igual vamos a /sign-in; las cookies se borran en el siguiente intento.
    }
    goTo("/sign-in");
  }
  return (
    <button type="button" className="boton boton--borde" onClick={salir} disabled={enviando}>
      {t("dashboard.logout")}
    </button>
  );
}
