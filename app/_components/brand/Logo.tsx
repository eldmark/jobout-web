import Link from "next/link";
import { t } from "@/lib/messages";
import { cn } from "@/lib/cn";

/**
 * Isotipo de la guía de marca: un marco índigo con `<` (código y formación) unido a un marco
 * coral con una flecha (la salida al mercado laboral). Decorativo: el nombre lo da el texto.
 */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cn("h-8 w-12", className)} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="28" height="30" rx="8" className="fill-indigo" />
      <rect x="19" y="1" width="28" height="30" rx="8" className="fill-coral" />
      <path d="M17 10l-6 6 6 6" className="fill-none stroke-white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 16h11m-4.5-5l5 5-5 5" className="fill-none stroke-ink" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Logo completo: «Job» en tinta (blanco sobre oscuro) y «Out» en coral. Por defecto enlaza al
 * inicio; con `enlace={false}` es solo la marca (el pie, para no repetir el enlace del encabezado).
 */
export default function Logo({
  className,
  claro = false,
  enlace = true,
}: {
  className?: string;
  /** Sobre fondo oscuro fijo (panel de registro): «Job» siempre en blanco. */
  claro?: boolean;
  enlace?: boolean;
}) {
  const clases = cn("inline-flex items-center gap-2 rounded-lg font-display text-xl font-bold tracking-tight no-underline", className);
  return enlace ? (
    <Link href="/" aria-label={t("home.nav.homeLabel")} className={clases}>
      <Marca claro={claro} />
    </Link>
  ) : (
    <span className={clases}>
      <Marca claro={claro} />
    </span>
  );
}

function Marca({ claro }: { claro: boolean }) {
  return (
    <>
      <Isotipo />
      <span className={claro ? "text-white" : "text-ink dark:text-white"}>
        {t("brand.wordmark.job")}
        <span className="text-coral">{t("brand.wordmark.out")}</span>
      </span>
    </>
  );
}
