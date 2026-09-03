import { NextResponse } from "next/server";

/**
 * Ruta pública a propósito: la usan el healthcheck de Docker y el orquestador.
 * No devuelve ningún dato de usuario.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jobout-web",
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
