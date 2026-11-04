import { authenticate, errorJson, isEmail, isPassword, readJson } from "@/lib/auth/server";

export async function POST(request: Request): Promise<Response> {
  const b = await readJson(request);
  const nombre = typeof b?.first_name === "string" ? b.first_name.trim() : "";
  const apellido = typeof b?.last_name === "string" ? b.last_name.trim() : "";
  if (!b || !isEmail(b.email) || !isPassword(b.password) || !nombre || !apellido) {
    return errorJson(422, "datos_invalidos");
  }
  return authenticate(
    "/auth/register",
    { email: b.email.trim(), password: b.password, first_name: nombre, last_name: apellido },
    201,
  );
}
