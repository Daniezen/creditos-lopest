import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAMES } from "@/server/auth/constants";

const PUBLIC_PATHS = ["/login", "/api/auth"];

/**
 * Middleware de protección superficial.
 *
 * Responsabilidad:
 * - Evitar que usuarios sin cookie de sesión entren a rutas privadas.
 *
 * Restricción importante:
 * - Este middleware NO sustituye autorización real.
 * - El control fuerte debe vivir en server components, queries y server actions
 *   mediante requireUser(), roles y filtros por cliente.
 *
 * Motivo:
 * - Una cookie puede existir pero el usuario puede estar desactivado.
 * - Un usuario puede tener sesión válida pero no tener permiso sobre un cliente.
 * - Por eso el middleware solo es una primera barrera de navegación.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const hasAuthCookie = AUTH_COOKIE_NAMES.some((cookieName) =>
    request.cookies.has(cookieName),
  );

  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image).*)"],
};
