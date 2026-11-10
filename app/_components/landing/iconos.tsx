/** Íconos de trazo para la portada. Decorativos: el texto de al lado dice lo mismo. */
import { cn } from "@/lib/cn";

function Icono({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconoFlecha = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icono>
);

export const IconoPersonas = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.87M15.5 4.13a3 3 0 0 1 0 5.75" />
  </Icono>
);

export const IconoConversacion = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="M21 12a8 8 0 0 1-11.6 7.15L4 20.5l1.35-4.4A8 8 0 1 1 21 12Z" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
  </Icono>
);

export const IconoGrafica = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icono>
);

export const IconoCodigo = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </Icono>
);

export const IconoCheck = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icono>
);

export const IconoCandado = ({ className }: { className?: string }) => (
  <Icono className={className}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icono>
);
