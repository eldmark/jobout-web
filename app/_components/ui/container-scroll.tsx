"use client";

/**
 * Container Scroll Animation — adaptado de Aceternity UI (ui.aceternity.com, licencia Aceternity:
 * uso permitido en productos finales; ver THIRD_PARTY_NOTICES.md). Publicado en 21st.dev:
 * https://21st.dev/@manuarora700/components/container-scroll-animation
 *
 * Al bajar, la tarjeta pasa de inclinada a derecha y el título sube un poco. Cambios respecto
 * del original: colores y sombra con los tokens de la marca (sin hex), alturas más contenidas y,
 * con «reducir movimiento», la tarjeta queda derecha y quieta.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

export default function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: ReactNode;
  children: ReactNode;
}) {
  const contenedor = useRef(null as HTMLDivElement | null);
  const reducir = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: contenedor });
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    const medir = () => {
      setEsMovil(window.innerWidth <= 768);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const rotacion = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const escala = useTransform(scrollYProgress, [0, 1], esMovil ? [0.75, 0.95] : [1.05, 1]);
  const subida = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div ref={contenedor} className="relative flex h-[52rem] items-center justify-center p-2 md:h-[72rem] md:p-16">
      <div className="relative w-full py-10 md:py-32" style={{ perspective: "1000px" }}>
        <motion.div style={reducir ? undefined : { translateY: subida }} className="mx-auto max-w-4xl text-center">
          {titleComponent}
        </motion.div>
        <motion.div
          data-scroll-card=""
          style={reducir ? undefined : { rotateX: rotacion, scale: escala }}
          className="mx-auto -mt-10 h-[34rem] w-full max-w-5xl rounded-[2rem] border border-lavender/40 bg-ink p-2 shadow-2xl shadow-ink/40 md:h-[38rem] md:p-4 dark:border-lavender/15 dark:shadow-indigo/20"
        >
          <div className="h-full w-full overflow-hidden rounded-[1.5rem] bg-white dark:bg-ink">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
