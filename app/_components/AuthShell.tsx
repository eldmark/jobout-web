import type { ReactNode } from "react";
import Logo from "@/app/_components/brand/Logo";
import BackgroundPaths from "@/app/_components/ui/background-paths";
import { IconoCheck } from "@/app/_components/landing/iconos";
import { t, type MessageKey } from "@/lib/messages";

const PUNTOS: MessageKey[] = ["auth.panel.point1", "auth.panel.point2", "auth.panel.point3"];

/**
 * Registro e ingreso: a la izquierda (pantallas anchas) un panel de marca sobre tinta con el
 * fondo de líneas; a la derecha el formulario de siempre. El panel no lleva títulos: el único
 * h1 de la página es el del formulario.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <BackgroundPaths className="h-full" lineClassName="text-lavender" count={36}>
          <div className="relative flex h-full flex-col justify-between bg-[radial-gradient(ellipse_at_bottom_left,color-mix(in_srgb,var(--color-indigo)_35%,transparent),transparent_60%)] p-12">
            <Logo claro />
            <div className="max-w-md">
              <p className="m-0 font-display text-4xl leading-tight font-bold tracking-tight text-balance text-white">{t("brand.slogan")}</p>
              <ul className="mt-8 flex list-none flex-col gap-4 p-0">
                {PUNTOS.map((k) => (
                  <li key={k} className="flex items-center gap-3 text-lavender">
                    <span className="flex size-7 items-center justify-center rounded-full bg-mint text-ink">
                      <IconoCheck className="size-4" />
                    </span>
                    {t(k)}
                  </li>
                ))}
              </ul>
            </div>
            <p className="m-0 text-sm text-lavender/70">{t("home.notice")}</p>
          </div>
        </BackgroundPaths>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
