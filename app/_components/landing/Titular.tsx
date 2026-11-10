import { cn } from "@/lib/cn";

/** Encabezado de sección: antetítulo, h2 y bajada. El id del h2 nombra a la sección. */
export default function Titular({
  id,
  antetitulo,
  titulo,
  bajada,
  className,
}: {
  id: string;
  antetitulo: string;
  titulo: string;
  bajada?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-bold tracking-[0.18em] text-indigo uppercase dark:text-coral">{antetitulo}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl dark:text-white">
        {titulo}
      </h2>
      {bajada ? <p className="mt-4 text-lg text-pretty text-ink/70 dark:text-lavender/75">{bajada}</p> : null}
    </div>
  );
}
