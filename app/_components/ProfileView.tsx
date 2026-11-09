"use client";

import { useCallback, useEffect, useState } from "react";
import CvList from "./CvList";
import ProfileForm from "./ProfileForm";
import { apiFetch, errorKey, fetchCvs, loadProfileScreen } from "@/lib/cv/client";
import { EMPTY_CATALOGS, fromProfile, type Catalogs, type FormState } from "@/lib/cv/form";
import type { CvSummary } from "@/lib/cv/types";
import { t } from "@/lib/messages";

type Carga = { estado: "cargando" } | { estado: "error" } | { estado: "listo"; inicial: FormState; catalogs: Catalogs };

export default function ProfileView() {
  const [carga, setCarga] = useState({ estado: "cargando" } as Carga);
  const [cvs, setCvs] = useState([] as CvSummary[]);
  const [intento, setIntento] = useState(0);

  const recargarCvs = useCallback(async () => {
    const lista = await fetchCvs();
    if (lista) setCvs(lista);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarga({ estado: "cargando" });
      const pantalla = await loadProfileScreen();
      if (!vivo) return;
      if (!pantalla) return setCarga({ estado: "error" });
      const { cat } = pantalla;
      const catalogs = { ...EMPTY_CATALOGS, skills: cat.skills ?? [], languages: cat.languages ?? [], academic: cat["academic-levels"] ?? [], professions: cat.professions ?? [], hierarchies: cat["job-hierarchies"] ?? [] };
      setCvs(pantalla.cvs);
      setCarga({ estado: "listo", inicial: fromProfile(pantalla.perfil, catalogs), catalogs });
    })();
    return () => {
      vivo = false;
    };
  }, [intento]);

  async function guardar(payload: unknown) {
    const r = await apiFetch("/api/profile", { method: "PUT", json: payload });
    if (r.status === 204) return { notice: "profile.saved" as const };
    if (r.status === 401) return { done: true as const };
    return { error: errorKey(r.status, r.error) };
  }

  if (carga.estado === "cargando") {
    return (
      <main className="pagina" aria-busy="true">
        <p role="status">{t("profile.loading")}</p>
      </main>
    );
  }
  if (carga.estado === "error") {
    return (
      <main className="pagina">
        <div className="formulario__error" role="alert" aria-live="assertive">
          {t("profile.error")}
        </div>
        <p>
          <button type="button" className="boton boton--borde" onClick={() => setIntento((n) => n + 1)}>
            {t("profile.retry")}
          </button>
        </p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <h1>{t("profile.title")}</h1>
      <p>
        <a href="/dashboard">{t("profile.back")}</a>
      </p>
      <section aria-labelledby="cvs-titulo" className="grupo">
        <h2 id="cvs-titulo">{t("profile.cvs.title")}</h2>
        {cvs.length === 0 ? <p className="campo__ayuda">{t("profile.cvs.empty")}</p> : <CvList cvs={cvs} onChanged={recargarCvs} />}
        <p>
          <a className="boton boton--borde" href="/profile/cv">
            {t("profile.cvs.upload")}
          </a>
        </p>
      </section>
      <ProfileForm initial={carga.inicial} catalogs={carga.catalogs} mode="profile" submitLabel="profile.save" busyLabel="profile.saving" onSubmit={guardar} />
    </main>
  );
}
