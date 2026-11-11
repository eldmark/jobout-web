/** Piezas del panel: tarjeta con color (`Kpi`), etiqueta de ejemplo y estado. Sin lógica de datos. */
import type { CSSProperties, ReactNode } from "react";
import { Icono, type IconName } from "./icons";
import { t } from "@/lib/messages";

export type Color = "indigo" | "coral" | "mint";

/** Marca un valor como ilustrativo: texto visible «Ejemplo» y un aria-label que lo explica. */
export function SampleChip() {
  return (
    <span className="ejemplo" role="note" aria-label={t("dashboard.sample.aria")}>
      {t("dashboard.sample.chip")}
    </span>
  );
}

export function Kpi({
  id,
  color,
  icon,
  label,
  index,
  wide = false,
  sample = false,
  children,
}: {
  id: string;
  color: Color;
  icon: IconName;
  label: string;
  /** Orden de entrada (escalonado). */
  index: number;
  wide?: boolean;
  sample?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={wide ? "kpi--ancha" : undefined} style={{ "--i": index } as CSSProperties}>
      <div className={`kpi c-${color}`} role="group" aria-labelledby={id}>
        <div className="kpi__cabecera">
          <span className="icono-chip">
            <Icono name={icon} />
          </span>
          <p className="kpi__etiqueta" id={id}>
            {label}
          </p>
          {sample ? <SampleChip /> : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export function Estado({ color, children }: { color: Color; children: ReactNode }) {
  return <span className={`estado c-${color}`}>{children}</span>;
}
