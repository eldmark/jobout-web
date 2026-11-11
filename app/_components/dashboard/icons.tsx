/** Iconos dibujados en línea (24×24, trazo de 2, extremos redondos). Decorativos: siempre aria-hidden. */
const FORMAS = {
  flame: ["M12 2.5c.8 3.3 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-1.7.7-3 1.7-4 .1 1.2.8 2 1.6 2.2C10.3 7.6 11.2 5 12 2.5Z"],
  target: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", "M12.5 12a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z"],
  star: ["m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"],
  chart: ["M4 19V5M4 19h16M8 15l3-4 3 2 4-6"],
  send: ["M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z"],
  search: ["M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z", "m20 20-3.5-3.5"],
  user: ["M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M4 21a8 8 0 0 1 16 0"],
  file: ["M7 3h7l5 5v13H7V3ZM14 3v5h5"],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M12 7v5l3 2"],
  offers: ["M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z", "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"],
  shield: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z", "m9 12 2 2 4-4"],
  building: ["M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"],
  inbox: ["m4 13 2-8h12l2 8v6H4v-6ZM4 13h5l1 2h4l1-2h5"],
  check: ["m5 12 4.5 4.5L19 7"],
  list: ["M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"],
} as const;

export type IconName = keyof typeof FORMAS;

export function Icono({ name }: { name: IconName }) {
  const relleno = name === "flame";
  return (
    <svg
      viewBox="0 0 24 24"
      fill={relleno ? "currentColor" : "none"}
      stroke={relleno ? "none" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {FORMAS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
