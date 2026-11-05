import { forward, idParam, noEncontrado } from "@/lib/cv/server";

/** F11: la descarga pasa por aquí; el navegador no ve el token ni nada del almacén. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = await idParam(ctx.params);
  if (!id) return noEncontrado();
  return forward(request, { method: "GET", path: `/cvs/${id}/file`, ok: { 200: "bytes" } });
}
