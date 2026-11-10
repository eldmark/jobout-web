"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { interviewsApi } from "@/lib/interviews/client";
import { formatDate } from "@/lib/interviews/format";
import type { Level, ProgressPoint } from "@/lib/interviews/types";
import { t, tf } from "@/lib/messages";

function evolucion(serie: ProgressPoint[]): string {
  if (serie.length < 2) return t("progress.evolution.first");
  const delta = serie[serie.length - 1].score - serie[0].score;
  if (delta === 1) return t("progress.evolution.upOne");
  if (delta > 0) return tf("progress.evolution.up", { n: delta });
  if (delta === -1) return t("progress.evolution.downOne");
  if (delta < 0) return tf("progress.evolution.down", { n: -delta });
  return t("progress.evolution.same");
}

function estadoNivel(l: Level): string {
  if (!l.available) return t("progress.unavailable");
  return l.unlocked ? t("progress.unlocked") : t("progress.locked");
}

export default function ProgressView() {
  const [datos, setDatos] = useState(null as { levels: Level[]; serie: ProgressPoint[] } | null);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    setFallo(false);
    setDatos(null);
    const [l, p] = await Promise.all([interviewsApi.levels(), interviewsApi.progress()]);
    if (l.data && p.data) {
      setDatos({
        levels: [...l.data.items].sort((a, b) => a.position - b.position),
        serie: [...p.data.items].sort((a, b) => a.completed_at.localeCompare(b.completed_at)),
      });
    } else if (l.status !== 401 && p.status !== 401) {
      setFallo(true);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (fallo) {
    return (
      <main className="pagina">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("progress.title")}</h1>
        <p className="formulario__error" role="alert">
          {t("progress.loadError")}
        </p>
        <button type="button" className="boton boton--borde" onClick={() => void cargar()}>
          {t("progress.retry")}
        </button>
      </main>
    );
  }
  if (!datos) {
    return (
      <main className="pagina" aria-busy="true">
        <p className="marca">{t("brand.name")}</p>
        <h1>{t("progress.title")}</h1>
        <p role="status">{t("progress.loading")}</p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("progress.title")}</h1>
      <section className="grupo" aria-labelledby="prog-niveles">
        <h2 id="prog-niveles">{t("progress.levels")}</h2>
        <ol className="lista" aria-labelledby="prog-niveles">
          {datos.levels.map((l) => (
            <li key={l.id} className="tarjeta" data-destacado={l.unlocked ? "true" : undefined}>
              <h3>{l.name}</h3>
              <p className="campo__ayuda">{estadoNivel(l)}</p>
              <p>{l.best_score === null ? t("progress.noBest") : `${t("progress.best")}: ${l.best_score}`}</p>
              <p className="campo__ayuda">
                {t("progress.sessions")}: {l.sessions_completed}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grupo" aria-labelledby="prog-evolucion">
        <h2 id="prog-evolucion">{t("progress.evolution")}</h2>
        {datos.serie.length === 0 ? (
          <>
            <p className="aviso">{t("progress.empty")}</p>
            <p>
              <Link className="boton boton--coral" href="/interviews">
                {t("progress.cta")}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p>{evolucion(datos.serie)}</p>
            <table className="tabla" aria-labelledby="prog-evolucion">
              <thead>
                <tr>
                  <th scope="col">{t("progress.col.date")}</th>
                  <th scope="col">{t("progress.col.level")}</th>
                  <th scope="col">{t("progress.col.recruiter")}</th>
                  <th scope="col">{t("progress.col.score")}</th>
                </tr>
              </thead>
              <tbody>
                {datos.serie.map((p) => (
                  <tr key={p.session_id}>
                    <td>{formatDate(p.completed_at)}</td>
                    <td>{p.level}</td>
                    <td>{p.recruiter}</td>
                    <td>{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <Link className="boton boton--coral" href="/interviews">
                {t("progress.cta")}
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
