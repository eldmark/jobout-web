import { forward, idParam, jsonBody, noEncontrado } from "@/lib/cv/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = await idParam(ctx.params);
  if (!id) return noEncontrado();
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  return forward(request, {
    method: "POST",
    path: `/cvs/${id}/extraction/confirm`,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    ok: { 204: "none" },
  });
}
