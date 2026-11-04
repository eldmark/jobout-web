/** Mensajes visibles en español (tuteo). Único lugar con texto de interfaz (F11). */
export const es = {
  "brand.name": "JobOut",
  "brand.slogan": "Llega listo a tu primera entrevista.",
  "brand.description": "Prepárate, practica y llega listo a tu primera entrevista en software.",
  "home.badge": "Primeros pasos",
  "home.notice": "Andamio inicial. La sala de entrevista y el dashboard llegan con sus fases.",
  "auth.sessionExpired": "Tu sesión terminó. Vuelve a iniciar sesión.",
} as const;

export type MessageKey = keyof typeof es;
