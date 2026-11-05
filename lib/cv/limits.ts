/** Reglas de archivo compartidas por el navegador (aviso temprano) y la capa servidor. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** El tipo real lo decide el backend por contenido; aquí solo se descarta lo evidente. */
export function isAllowedCvType(name: string, mime: string): boolean {
  const n = name.toLowerCase();
  const m = mime.toLowerCase();
  const extOk = n.endsWith(".pdf") || n.endsWith(".docx");
  const mimeOk = m === "" || m === "application/pdf" || m === DOCX || m === "application/octet-stream";
  return extOk && mimeOk;
}
