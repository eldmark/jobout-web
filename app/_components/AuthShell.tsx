import type { ReactNode } from "react";
import Logo from "@/app/_components/brand/Logo";
import BackgroundPaths from "@/app/_components/ui/background-paths";
import { IconoCheck } from "@/app/_components/landing/iconos";
import { t, type MessageKey } from "@/lib/messages";

const PUNTOS: MessageKey[] = ["auth.panel.point1", "auth.panel.point2", "auth.panel.point3"];

/**
 * Registro e ingreso: el fondo de líneas cubre toda la pantalla (no hay dos paneles con un corte
 * entre ellos) y el formulario flota encima en una tarjeta translúcida. En pantallas anchas, a la
 * izquierda va el mensaje de marca. Todo cabe en una pantalla de laptop sin hacer scroll.
 * La página tiene un solo h1: el del formulario.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <BackgroundPaths
      className="min-h-svh bg-[radial-gradient(ellipse_at_top_left,var(--color-lavender),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--color-indigo)_30%,transparent),transparent_60%)]"
      lineClassName="text-indigo dark:text-lavender"
      count={36}
    >
      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-x-20 gap-y-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <aside className="hidden lg:block">
          <Logo />
          <p className="mt-16 mb-0 font-display text-5xl leading-[1.08] font-bold tracking-tight text-balance text-ink dark:text-white">
            {t("brand.slogan")}
          </p>
          <ul className="mt-10 flex list-none flex-col gap-4 p-0 text-lg">
            {PUNTOS.map((k) => (
              <li key={k} className="flex items-center gap-3 text-ink/80 dark:text-lavender">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
                  <IconoCheck className="size-4" />
                </span>
                {t(k)}
              </li>
            ))}
          </ul>
        </aside>

        <main className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <div className="auth-form rounded-3xl border border-ink/10 bg-white/85 p-7 shadow-2xl shadow-indigo/10 backdrop-blur-md sm:p-8 dark:border-white/10 dark:bg-ink/75 dark:shadow-none">
            {children}
          </div>
        </main>
      </div>
    </BackgroundPaths>
  );
}
