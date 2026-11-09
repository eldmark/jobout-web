import { es, type MessageKey } from "./es";

export type { MessageKey };

/** Devuelve el texto de la clave. Lanza si no existe: mejor fallar que pintar una clave cruda. */
export function t(key: MessageKey): string {
  const value = (es as Record<string, string>)[key];
  if (value === undefined) throw new Error(`Mensaje inexistente: ${key}`);
  return value;
}

/** Como `t`, pero reemplaza {nombre} por su valor. Lanza si falta alguno: nunca pinta una llave cruda. */
export function tf(key: MessageKey, values: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, nombre: string) => {
    if (!(nombre in values)) throw new Error(`Falta el valor {${nombre}} en ${key}`);
    return String(values[nombre]);
  });
}
