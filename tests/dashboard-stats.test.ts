/** Agregados del panel de la persona candidata: puros, sin red ni reloj (el «ahora» se inyecta). */
import { describe, it, expect } from "vitest";
import { dayKey, summarize, completion } from "@/lib/dashboard/stats";
import type { ProgressPoint } from "@/lib/interviews/types";

const p = (completed_at: string, score: number): ProgressPoint => ({ session_id: completed_at, completed_at, level: "Básico", recruiter: "Ana", score });
const NOW = new Date("2026-11-11T15:00:00Z");

describe("dayKey", () => {
  it("usa la zona horaria pedida, no la del servidor", () => {
    expect(dayKey("2026-11-11T02:30:00Z", "UTC")).toBe("2026-11-11");
    expect(dayKey("2026-11-11T02:30:00Z", "America/La_Paz")).toBe("2026-11-10");
  });
  it("una fecha inválida no tiene día", () => {
    expect(dayKey("no-es-fecha", "UTC")).toBeNull();
  });
});

describe("summarize", () => {
  it("sin prácticas: todo en cero y sin racha", () => {
    const s = summarize([], NOW, "UTC");
    expect(s).toMatchObject({ count: 0, average: null, best: null, last: null, streak: 0, series: [] });
    expect(s.week).toHaveLength(7);
    expect(s.week.every((d) => !d.done)).toBe(true);
  });

  const casos: { nombre: string; puntos: ProgressPoint[]; esperado: Record<string, unknown> }[] = [
    { nombre: "una práctica hoy", puntos: [p("2026-11-11T10:00:00Z", 80)], esperado: { count: 1, average: 80, best: 80, last: 80, streak: 1 } },
    { nombre: "promedio redondeado y mejor puntaje", puntos: [p("2026-11-01T10:00:00Z", 70), p("2026-11-02T10:00:00Z", 85), p("2026-11-03T10:00:00Z", 90)], esperado: { count: 3, average: 82, best: 90, last: 90, streak: 0 } },
    { nombre: "racha de tres días hasta hoy", puntos: [p("2026-11-09T10:00:00Z", 60), p("2026-11-10T10:00:00Z", 65), p("2026-11-11T10:00:00Z", 70)], esperado: { streak: 3 } },
    { nombre: "la racha sigue viva si la última fue ayer", puntos: [p("2026-11-09T10:00:00Z", 60), p("2026-11-10T10:00:00Z", 65)], esperado: { streak: 2 } },
    { nombre: "un día sin práctica antes de ayer la corta", puntos: [p("2026-11-08T10:00:00Z", 60), p("2026-11-10T10:00:00Z", 65)], esperado: { streak: 1 } },
    { nombre: "varias prácticas el mismo día cuentan un día", puntos: [p("2026-11-11T08:00:00Z", 60), p("2026-11-11T12:00:00Z", 65)], esperado: { count: 2, streak: 1 } },
    { nombre: "llegan desordenadas: «última» es la más reciente", puntos: [p("2026-11-11T10:00:00Z", 77), p("2026-11-05T10:00:00Z", 50)], esperado: { last: 77, best: 77 } },
  ];
  for (const c of casos) it(c.nombre, () => expect(summarize(c.puntos, NOW, "UTC")).toMatchObject(c.esperado));

  it("la serie del gráfico son los últimos 12 puntajes en orden cronológico", () => {
    const muchos = Array.from({ length: 15 }, (_, i) => p(`2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`, i));
    expect(summarize(muchos, NOW, "UTC").series).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("la semana marca los días con práctica, de hace 6 días a hoy", () => {
    const s = summarize([p("2026-11-05T10:00:00Z", 60), p("2026-11-11T10:00:00Z", 60)], NOW, "UTC");
    expect(s.week.map((d) => d.key)).toEqual(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(s.week.map((d) => d.done)).toEqual([true, false, false, false, false, false, true]);
    expect(s.week[6].today).toBe(true);
  });

  it("ignora puntos con fecha o puntaje inválidos", () => {
    const s = summarize([p("basura", 50), { ...p("2026-11-11T10:00:00Z", 0), score: Number.NaN }, p("2026-11-11T10:00:00Z", 40)], NOW, "UTC");
    expect(s.count).toBe(1);
    expect(s.best).toBe(40);
  });

  it("respeta la zona horaria al contar la racha", () => {
    // 02:00 UTC del 11 es la noche del 10 en La Paz: ahí «hoy» es el 11 a las 11:00 UTC.
    const s = summarize([p("2026-11-11T02:00:00Z", 60)], NOW, "America/La_Paz");
    expect(s.week[6].key).toBe("2026-11-11");
    expect(s.week[5].done).toBe(true);
    expect(s.streak).toBe(1);
  });
});

describe("completion", () => {
  it("cuenta los pasos hechos y da el porcentaje", () => {
    expect(completion({ cv: true, skills: false, practice: true, application: false })).toEqual({ done: 2, total: 4, percent: 50 });
    expect(completion({ cv: false, skills: false, practice: false, application: false }).percent).toBe(0);
    expect(completion({ cv: true, skills: true, practice: true, application: true }).percent).toBe(100);
  });
  it("un paso desconocido (null) no cuenta como hecho", () => {
    expect(completion({ cv: null, skills: true, practice: false, application: null }).done).toBe(1);
  });
});
