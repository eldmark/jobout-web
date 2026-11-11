"use client";

import { useEffect, useRef, useState } from "react";
import { avatarPalette, initials, speakingDurationMs, type AvatarState } from "@/lib/avatar/palette";
import type { AvatarScene } from "./avatar-scene";

const REDUCED = "(prefers-reduced-motion: reduce)";
const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED).matches;
const hasWebGL = () => typeof window !== "undefined" && "WebGL2RenderingContext" in window;

/**
 * Estado del avatar a partir de la sala: pensando mientras se espera al recruiter,
 * hablando durante un tiempo proporcional al último texto nuevo, y en reposo el resto.
 * `turnKey` identifica el turno del recruiter; cambia solo cuando llega uno nuevo.
 */
export function useAvatarState(thinking: boolean, turnKey: number | null, text: string): AvatarState {
  const [speaking, setSpeaking] = useState(false);
  const seen = useRef(null as number | null);
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => {
    if (turnKey === null || turnKey === seen.current) return;
    seen.current = turnKey;
    setSpeaking(true);
    const id = setTimeout(() => setSpeaking(false), speakingDurationMs(textRef.current));
    return () => clearTimeout(id);
  }, [turnKey]);
  return thinking ? "thinking" : speaking ? "speaking" : "idle";
}

/**
 * Entrevistador 3D caricaturesco (three.js, cargado bajo demanda). Es decorativo:
 * la transcripción de texto sigue siendo la fuente accesible. Sin WebGL, o si three
 * no carga, muestra un círculo con la inicial.
 */
export default function InterviewerAvatar({ name, state }: { name: string; state: AvatarState }) {
  const canvas = useRef(null as HTMLCanvasElement | null);
  const box = useRef(null as HTMLDivElement | null);
  const scene = useRef(null as AvatarScene | null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [mode, setMode] = useState("fallback" as "fallback" | "canvas");
  const palette = avatarPalette(name);
  const paletteKey = JSON.stringify(palette);

  useEffect(() => {
    if (!hasWebGL() || !canvas.current || !box.current) return;
    let cancelled = false;
    let raf = 0;
    let observer: ResizeObserver | undefined;
    let made: AvatarScene | null = null;
    const el = canvas.current;
    const holder = box.current;
    const reduced = reducedMotion();
    const t0 = performance.now();
    const fit = () => made?.resize(holder.clientWidth, holder.clientHeight);
    const frame = () => {
      raf = 0;
      if (cancelled || !made) return;
      made.render(reduced ? 0 : (performance.now() - t0) / 1000);
      if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduced) raf = requestAnimationFrame(frame);
    };

    import("./avatar-scene")
      .then(({ createAvatarScene }) => {
        if (cancelled) return;
        made = createAvatarScene(el, JSON.parse(paletteKey));
        scene.current = made;
        made.setState(stateRef.current);
        fit();
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            fit();
            if (reduced) made?.render(0);
          });
          observer.observe(holder);
        }
        document.addEventListener("visibilitychange", onVisibility);
        setMode("canvas");
        frame();
      })
      .catch(() => {
        // three no cargó o no hay contexto WebGL: se queda el avatar 2D.
        made?.dispose();
        made = null;
        scene.current = null;
        if (!cancelled) setMode("fallback");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      made?.dispose();
      scene.current = null;
    };
  }, [paletteKey]);

  useEffect(() => {
    scene.current?.setState(state);
    // Con movimiento reducido no hay bucle: se repinta el fotograma estático.
    if (reducedMotion()) scene.current?.render(0);
  }, [state]);

  return (
    <div ref={box} className="avatar" data-state={state} data-mode={mode} style={{ "--avatar-shirt": palette.shirt, "--avatar-skin": palette.skin } as React.CSSProperties}>
      <canvas ref={canvas} className="avatar__canvas" aria-hidden="true" hidden={mode !== "canvas"} />
      {mode === "fallback" ? (
        <div className="avatar__fallback" aria-hidden="true" data-testid="avatar-fallback">
          <span className="avatar__initials">{initials(name)}</span>
          <span className="avatar__dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : null}
    </div>
  );
}
