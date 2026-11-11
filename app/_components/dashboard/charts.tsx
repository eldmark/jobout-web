/** Gráficos pequeños dibujados con SVG: decorativos (aria-hidden); la cifra y su texto van aparte. */
import type { CSSProperties } from "react";

/** Anillo de avance de 0 a 100. El arco usa pathLength = 100, así el CSS lo dibuja con `--p`. */
export function Ring({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg className="anillo" viewBox="0 0 48 48" fill="none" strokeWidth="6" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle className="anillo__pista" cx="24" cy="24" r="19" />
      <circle className="anillo__arco" cx="24" cy="24" r="19" pathLength="100" transform="rotate(-90 24 24)" style={{ "--p": p } as CSSProperties} />
    </svg>
  );
}

const W = 120;
const H = 36;
const PAD = 4;

/** Línea de puntajes con el área bajo ella y un punto al final. Con menos de dos puntos no dibuja nada. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = values.map((v, i): [number, number] => [PAD + (i * (W - PAD * 2)) / (values.length - 1), H - PAD - ((v - min) / span) * (H - PAD * 2)]);
  const linea = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${linea} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`;
  const [fx, fy] = xy[xy.length - 1];
  return (
    <svg className="mini-grafico" viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true" focusable="false">
      <path className="mini-grafico__area" d={area} stroke="none" />
      <path className="mini-grafico__linea" d={linea} pathLength={1} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="mini-grafico__punto" cx={fx} cy={fy} r="3.5" strokeWidth="2" />
    </svg>
  );
}
