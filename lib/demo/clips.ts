/** Clips de la demo (public/demo). Los GIF son capturas del recorrido en navegador con datos inventados. */
export type Clip = { file: string; title: string; description: string; alt: string };

/** Tamaño real de los GIF: se declara para que la página no salte al cargarlos. */
export const CLIP_SIZE = { width: 1560, height: 723 } as const;

export const CLIPS: readonly Clip[] = [
  {
    file: "candidato-oferta-practicar-retirar.gif",
    title: "Candidata: oferta, práctica y retiro",
    description:
      "Una candidata abre una oferta, ve la afinidad con su perfil, puede practicar la entrevista de ese puesto, revisa sus aplicaciones y retira una: la empresa deja de ver lo que había compartido.",
    alt: "Grabación de pantalla: detalle de una oferta con afinidad, aplicaciones de la candidata y el diálogo para retirar una aplicación.",
  },
  {
    file: "empresa-equipo-oferta-verificacion.gif",
    title: "Empresa: equipo, oferta y verificación",
    description:
      "La reclutadora invita a su equipo, define los requisitos de una oferta y la plataforma verifica la empresa y fija su membresía para poder publicar.",
    alt: "Grabación de pantalla: inicio de sesión de la reclutadora, invitación al equipo, requisitos de una oferta y la pantalla de verificación de empresas.",
  },
  {
    file: "empresa-panel-aplicaciones.gif",
    title: "Empresa: panel de aplicantes",
    description:
      "El panel lista a quienes aplicaron y, al abrir una aplicación, muestra solo lo que la persona decidió compartir; desde ahí se marca como favorita o se mueve de estado con una nota interna.",
    alt: "Grabación de pantalla: panel de aplicaciones con filtros, detalle de una aplicante y el diálogo para mover a En revisión.",
  },
  {
    file: "borrado-de-cuentas.gif",
    title: "Borrado de cuenta",
    description:
      "Borrar la cuenta pide la contraseña y avisa qué se pierde; los datos personales se eliminan y lo que queda en la empresa se anonimiza.",
    alt: "Grabación de pantalla: diálogo para borrar la cuenta con confirmación de contraseña y regreso a la pantalla de ingreso.",
  },
];
