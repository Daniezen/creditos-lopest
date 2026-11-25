/**
 * Constantes edge-safe de autenticación.
 *
 * Intención:
 * - Compartir nombres de cookies entre el proxy (src/proxy.ts) y código server.
 *
 * Restricción crítica:
 * - Este archivo NO debe importar Prisma, node:crypto, cookies(), headers()
 *   ni ningún módulo dependiente de Node Runtime.
 *
 * Motivo:
 * - src/proxy.ts se carga fuera del grafo server habitual (y en Vitest sin alias).
 * - Si el proxy importa indirectamente módulos Node, Next puede compilar
 *   con advertencias o fallos por runtime incompatible.
 */
export const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];
