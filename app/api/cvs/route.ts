import { forward } from "@/lib/cv/server";
import { MAX_CV_BYTES, isAllowedCvType } from "@/lib/cv/limits";
import { authedBackend, errorJson } from "@/lib/auth/server";

export async function GET(request: Request): Promise<Response> {
  return forward(request, { method: "GET", path: "/cvs", ok: { 200: "json" } });
}

/** Valida tamaño y tipo ANTES de reenviar; el backend vuelve a validar por contenido. */
export async function POST(request: Request): Promise<Response> {
  if (!authedBackend(request).hasSession) return errorJson(401, "sesion_expirada");

  // Tope barato antes de leer el cuerpo (margen para los bordes del multipart).
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_CV_BYTES + 64 * 1024) {
    return errorJson(413, "archivo_demasiado_grande");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorJson(422, "datos_invalidos");
  }
  const archivos = form.getAll("file");
  const file = archivos[0];
  if (archivos.length !== 1 || typeof file === "string") return errorJson(422, "datos_invalidos");
  if (file.size > MAX_CV_BYTES) return errorJson(413, "archivo_demasiado_grande");
  if (!isAllowedCvType(file.name, file.type)) return errorJson(415, "tipo_no_permitido");

  const salida = new FormData();
  salida.set("file", file, file.name);
  return forward(request, { method: "POST", path: "/cvs", body: salida, ok: { 201: "json" } });
}
