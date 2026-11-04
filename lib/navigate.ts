/** Navegación completa del navegador (recarga y reevalúa el middleware). Se simula en pruebas. */
export function goTo(path: string): void {
  window.location.assign(path);
}
