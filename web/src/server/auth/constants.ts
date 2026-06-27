/**
 * Constantes de autenticación compartibles entre Node runtime y Edge runtime.
 *
 * Regla crítica:
 * este archivo debe ser seguro para Edge Runtime.
 *
 * Por eso NO debe importar:
 * - Prisma;
 * - node:crypto;
 * - cookies();
 * - headers();
 * - módulos que dependan de runtime Node.
 *
 * El middleware puede importar este archivo sin arrastrar dependencias
 * incompatibles con Edge.
 */
export const SESSION_COOKIE_NAME = "lopest_session";
