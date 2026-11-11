import Link from "next/link";
import { t } from "@/lib/messages";
import { CLIPS, CLIP_SIZE } from "@/lib/demo/clips";

export const metadata = { title: t("demo.metaTitle") };

/** Página pública con los GIF de la presentación del MVP. Solo muestra; no llama al backend. */
export default function Demo() {
  return (
    <main className="pagina pagina--demo">
      <p className="marca">{t("brand.name")}</p>
      <h1>{t("demo.title")}</h1>
      <p className="eslogan">{t("demo.intro")}</p>
      <div className="demo__lista">
        {CLIPS.map((c) => (
          <figure key={c.file} className="demo__clip" aria-labelledby={`demo-${c.file}`}>
            {/* GIF animado: next/image no lo optimiza, se sirve tal cual. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/demo/${c.file}`}
              alt={c.alt}
              width={CLIP_SIZE.width}
              height={CLIP_SIZE.height}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <strong id={`demo-${c.file}`}>{c.title}</strong>
              <span>{c.description}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p>
        <Link className="boton" href="/">
          {t("demo.back")}
        </Link>
      </p>
    </main>
  );
}
