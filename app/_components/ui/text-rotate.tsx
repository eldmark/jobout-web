"use client";

/**
 * Text Rotate — adaptado de Fancy Components (© 2024 Daniel Petho, licencia MIT; ver
 * THIRD_PARTY_NOTICES.md). Publicado en 21st.dev: https://21st.dev/@danielpetho/components/text-rotate
 *
 * Cambios respecto del original: sin API imperativa (ref) ni `onNext`, que no se usan; con
 * «reducir movimiento» no rota y se queda en el primer texto; `span` por defecto, para poder
 * ir dentro de un párrafo.
 */

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { AnimatePresence, motion, useReducedMotion, type MotionProps, type Transition } from "motion/react";
import { cn } from "@/lib/cn";

/** Separa en caracteres respetando tildes compuestas y emojis. */
const separarEnCaracteres = (texto: string): string[] => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmentador = new Intl.Segmenter("es", { granularity: "grapheme" });
    return Array.from(segmentador.segment(texto), ({ segment }) => segment);
  }
  return Array.from(texto);
};

interface Palabra {
  caracteres: string[];
  conEspacio: boolean;
}

export interface TextRotateProps {
  texts: string[];
  as?: ElementType;
  /** Milisegundos entre un texto y el siguiente. */
  rotationInterval?: number;
  initial?: MotionProps["initial"];
  animate?: MotionProps["animate"];
  exit?: MotionProps["exit"];
  /** Segundos entre letra y letra. */
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center";
  transition?: Transition;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

export default function TextRotate({
  texts,
  as = "span",
  rotationInterval = 2000,
  initial = { y: "100%", opacity: 0 },
  animate = { y: 0, opacity: 1 },
  exit = { y: "-120%", opacity: 0 },
  staggerDuration = 0,
  staggerFrom = "first",
  transition = { type: "spring", damping: 25, stiffness: 300 },
  mainClassName,
  splitLevelClassName,
  elementLevelClassName,
}: TextRotateProps) {
  const reducir = useReducedMotion();
  const [indice, setIndice] = useState(0);

  const palabras = useMemo<Palabra[]>(() => {
    const partes = texts[indice].split(" ");
    return partes.map((p, i) => ({ caracteres: separarEnCaracteres(p), conEspacio: i !== partes.length - 1 }));
  }, [texts, indice]);

  const totalCaracteres = palabras.reduce((suma, p) => suma + p.caracteres.length, 0);

  const retraso = useCallback(
    (i: number) => {
      if (staggerFrom === "last") return (totalCaracteres - 1 - i) * staggerDuration;
      if (staggerFrom === "center") return Math.abs(Math.floor(totalCaracteres / 2) - i) * staggerDuration;
      return i * staggerDuration;
    },
    [staggerFrom, staggerDuration, totalCaracteres],
  );

  useEffect(() => {
    if (reducir || texts.length < 2) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % texts.length), rotationInterval);
    return () => clearInterval(id);
  }, [reducir, texts.length, rotationInterval]);

  const Contenedor = useMemo(() => {
    return motion.create(as);
  }, [as]);

  return (
    <Contenedor className={cn("inline-flex flex-wrap whitespace-pre-wrap", mainClassName)} transition={transition} layout>
      <span className="sr-only">{texts[indice]}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={indice} className="inline-flex flex-wrap" aria-hidden="true" layout>
          {palabras.map((palabra, ip) => {
            const previos = palabras.slice(0, ip).reduce((suma, p) => {
              return suma + p.caracteres.length;
            }, 0);
            return (
              <span key={ip} className={cn("inline-flex", splitLevelClassName)}>
                {palabra.caracteres.map((caracter, ic) => (
                  <span key={previos + ic} className={elementLevelClassName}>
                    <motion.span
                      className="inline-block"
                      initial={initial}
                      animate={animate}
                      exit={exit}
                      transition={{ ...transition, delay: retraso(previos + ic) }}
                    >
                      {caracter}
                    </motion.span>
                  </span>
                ))}
                {palabra.conEspacio ? <span className="whitespace-pre"> </span> : null}
              </span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </Contenedor>
  );
}
