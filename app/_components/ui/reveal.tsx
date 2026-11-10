"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type Estado = "visible" | "oculto" | "entrando";

/**
 * Hace aparecer su contenido al llegar a él con el scroll.
 *
 * Nunca esconde nada por defecto: el HTML del servidor sale visible, y solo se esconde (para
 * aparecer después) lo que al cargar está **debajo** de la pantalla, cuando hay JavaScript,
 * `IntersectionObserver` y la persona no pidió reducir el movimiento. Lo que ya se ve al
 * cargar no parpadea.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Segundos de espera al aparecer, para escalonar tarjetas vecinas. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null as HTMLDivElement | null);
  const reducir = useReducedMotion();
  const [estado, setEstado] = useState("visible" as Estado);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducir || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setEstado("oculto");
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setEstado("entrando");
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [reducir]);

  const oculto = estado === "oculto";
  return (
    <motion.div
      ref={ref}
      className={className}
      data-reveal={estado}
      initial={false}
      animate={oculto ? { opacity: 0, y: 28 } : { opacity: 1, y: 0 }}
      transition={oculto ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
