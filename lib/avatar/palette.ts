/** Estados del avatar del entrevistador y datos puros que lo describen (sin three.js). */
export type AvatarState = "idle" | "thinking" | "speaking";

export type AvatarPalette = { skin: string; hair: string; shirt: string; hairStyle: "long" | "short" | "bun" };

const DEFAULT_PALETTE: AvatarPalette = { skin: "#f1c27d", hair: "#4a3424", shirt: "#7c6cf0", hairStyle: "short" };

/** Los 5 reclutadores fijos; se resuelven por nombre visible porque el id es un UUID opaco. */
const PALETTES: Record<string, AvatarPalette> = {
  ana: { skin: "#f2c9a0", hair: "#5a3825", shirt: "#e8618c", hairStyle: "long" },
  martin: { skin: "#c68863", hair: "#1f1a17", shirt: "#3b82c4", hairStyle: "short" },
  laura: { skin: "#ffdbb4", hair: "#d9a441", shirt: "#2fa88a", hairStyle: "bun" },
  carlos: { skin: "#8d5a3b", hair: "#2b2b2b", shirt: "#f0913a", hairStyle: "short" },
  sofia: { skin: "#e0ac82", hair: "#a23b2a", shirt: "#8456d6", hairStyle: "long" },
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function avatarPalette(displayName: string | null | undefined): AvatarPalette {
  return PALETTES[norm(displayName ?? "")] ?? DEFAULT_PALETTE;
}

export function initials(displayName: string | null | undefined): string {
  const n = (displayName ?? "").trim();
  return n === "" ? "?" : Array.from(n)[0]!.toUpperCase();
}

/** Duración de la animación de habla: proporcional al texto, acotada para que no sea ni un parpadeo ni eterna. */
export function speakingDurationMs(text: string): number {
  return Math.min(8000, Math.max(1500, Array.from(text).length * 45));
}
