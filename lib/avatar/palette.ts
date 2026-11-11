/** Estados del avatar del entrevistador y datos puros que lo describen (sin three.js). */
export type AvatarState = "idle" | "thinking" | "speaking";

/** Colores como 0xRRGGBB (los hex con # los reserva el CSS de marca). */
export type AvatarPalette = { skin: number; hair: number; shirt: number; hairStyle: "long" | "short" | "bun" };

const DEFAULT_PALETTE: AvatarPalette = { skin: 0xf1c27d, hair: 0x4a3424, shirt: 0x7c6cf0, hairStyle: "short" };

/** Los 5 reclutadores fijos; se resuelven por nombre visible porque el id es un UUID opaco. */
const PALETTES: Record<string, AvatarPalette> = {
  ana: { skin: 0xf2c9a0, hair: 0x5a3825, shirt: 0xe8618c, hairStyle: "long" },
  martin: { skin: 0xc68863, hair: 0x1f1a17, shirt: 0x3b82c4, hairStyle: "short" },
  laura: { skin: 0xffdbb4, hair: 0xd9a441, shirt: 0x2fa88a, hairStyle: "bun" },
  carlos: { skin: 0x8d5a3b, hair: 0x2b2b2b, shirt: 0xf0913a, hairStyle: "short" },
  sofia: { skin: 0xe0ac82, hair: 0xa23b2a, shirt: 0x8456d6, hairStyle: "long" },
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

/** Valor CSS `rgb()` de un color numérico, para variables inline. */
export const cssColor = (c: number) => `rgb(${(c >> 16) & 255} ${(c >> 8) & 255} ${c & 255})`;

export function initials(displayName: string | null | undefined): string {
  const n = (displayName ?? "").trim();
  return n === "" ? "?" : Array.from(n)[0]!.toUpperCase();
}

/** Duración de la animación de habla: proporcional al texto, acotada para que no sea ni un parpadeo ni eterna. */
export function speakingDurationMs(text: string): number {
  return Math.min(8000, Math.max(1500, Array.from(text).length * 45));
}
