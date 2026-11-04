import { authenticate, errorJson, isEmail, readJson } from "@/lib/auth/server";

export async function POST(request: Request): Promise<Response> {
  const b = await readJson(request);
  if (!b || !isEmail(b.email) || typeof b.password !== "string" || !b.password) {
    return errorJson(422, "datos_invalidos");
  }
  return authenticate("/auth/login", { email: b.email.trim(), password: b.password }, 200);
}
