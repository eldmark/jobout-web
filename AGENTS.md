# AGENTS.md — jobout-web

**Las reglas del proyecto viven en [`jobout-docs`](https://github.com/eldmark/jobout-docs).**
Este archivo es el resumen; ante cualquier duda, manda `jobout-docs/AGENTS.md`.

## Qué es este servicio

La interfaz de JobOut. **Next.js**.

**No persiste nada.** Pinta lo que devuelve `jobout-core-api` y conduce la conversación de audio
contra `jobout-interview`. PII pasa por acá en tránsito, nunca se guarda.

## Antes de tocar nada

1. `jobout-docs/docs/continue.md` — qué se hizo y qué sigue
2. `jobout-docs/documentation/frontend.md` — decisiones de esta capa
3. `git status --short` acá

## Reglas no negociables

1. **Nunca** commitees `.env*`, claves ni `docker-compose.yml`
2. **`NEXT_PUBLIC_` viaja al navegador.** Un secreto nunca lleva ese prefijo. El CI lo verifica
3. Ningún dato sensible en `localStorage` ni en `sessionStorage`
4. Ningún `console.log` con datos de usuario en producción
5. **Los casos de verdad se acuerdan antes de codear**, en el archivo de fase. Después el test
   en rojo, después el código
6. Componente nuevo nace con su prueba
7. **Toda pantalla maneja sus tres estados: cargando, vacío y error.** Un estado vacío sin
   diseñar es una pantalla rota
8. En la sala de entrevista, el estado es visible siempre — escuchando · pensando · hablando.
   El silencio sin explicación se lee como que se rompió
9. La transcripción en vivo no es un extra: es lo que vuelve usable la entrevista sin audio

## Cómo correr

```bash
cp .env.example .env.local && cp docker-compose.example.yml docker-compose.yml
docker compose up                 # solo el frontend
npm test                          # pruebas
npm run lint && npm run typecheck
```

Backend + frontend juntos: `cd ../jobout-docs && make dev`

## Commits y PRs

- Rama `jb-##-slug`. El CI rechaza otro formato
- Mensajes **en inglés**, sin atribución de IA de ningún tipo
- Las cuatro secciones del PR son obligatorias
- Squash merge, una aprobación, CI verde

## Al terminar

- `npm test`, `npm run lint` y `npm run typecheck` en verde
- **La pantalla abierta en un navegador.** Las pruebas verdes no dicen que la vista sirva
- `jobout-docs/docs/continue.md` actualizado
