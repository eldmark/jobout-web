"use client";

import { useEffect, useState } from "react";

/**
 * Cifra que sube de 0 al valor. El valor real va siempre en el DOM para lectores de pantalla y para
 * quien no tiene JavaScript; la cifra animada es solo decoración. Con «reducir movimiento» no anima.
 */
export default function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const quieto = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto || value <= 0 || typeof window.requestAnimationFrame !== "function") return;
    let raf = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - inicio) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="solo-lectores">{value}</span>
    </>
  );
}
