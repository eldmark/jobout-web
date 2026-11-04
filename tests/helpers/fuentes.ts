import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const RAIZ = path.resolve(__dirname, "../..");

export function leer(rel: string): string {
  return readFileSync(path.join(RAIZ, rel), "utf8");
}

/** Archivos .tsx/.ts bajo un directorio (relativo a la raíz del repo). */
export function listar(dir: string, ext = /\.(tsx?|jsx?)$/): string[] {
  const salida: string[] = [];
  const recorrer = (d: string) => {
    for (const nombre of readdirSync(d)) {
      const completo = path.join(d, nombre);
      if (statSync(completo).isDirectory()) recorrer(completo);
      else if (ext.test(nombre)) salida.push(path.relative(RAIZ, completo));
    }
  };
  recorrer(path.join(RAIZ, dir));
  return salida;
}
