import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

interface GoogleProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Opciones centrales de NextAuth v4.
 *
 * Decisiones:
 * - Google autentica la identidad real.
 * - La base interna autoriza acceso mediante User + Role.
 * - No se permite login de correos no preautorizados.
 * - No usamos Prisma Adapter aquí porque queremos mantener control explícito
 *   sobre User, Role, OAuthAccount y auditoría.
 *
 * Riesgo controlado:
 * - Google puede autenticar un correo válido, pero eso NO implica acceso.
 *   El acceso solo se concede si users.email existe, está activo y tiene rol.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "missing-google-client-id",
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? "missing-google-client-secret",
    }),
  ],

  callbacks: {
    /**
     * Gatekeeper de entrada.
     *
     * Este callback se ejecuta después de que Google autentica la cuenta.
     * Aquí decidimos si esa identidad Google puede entrar a Lopest.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      const googleProfile = profile as GoogleProfile | undefined;

      const email = googleProfile?.email?.trim().toLowerCase();
      const emailVerified = Boolean(googleProfile?.email_verified);
      const providerAccountId =
        account.providerAccountId || googleProfile?.sub || "";

      if (!email || !emailVerified || !providerAccountId) {
        return false;
      }

      const user = await prisma.user.findUnique({
        where: {
          email,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user || !user.activo || user.roles.length === 0) {
        return false;
      }

      /**
       * Persistimos la relación OAuth para trazabilidad.
       *
       * No dependemos de esta tabla para autorizar en este punto; la autorización
       * viene de User/Role. Esta tabla sirve para auditoría técnica y futuras
       * integraciones con proveedores adicionales.
       */
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            nombre: user.nombre || googleProfile?.name || email,
            photoUrl: googleProfile?.picture ?? user.photoUrl,
            lastLoginAt: new Date(),
          },
        });

        await tx.oauthAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId,
            },
          },
          create: {
            userId: user.id,
            provider: "google",
            providerAccountId,
            email,
            emailVerified,
            pictureUrl: googleProfile?.picture ?? null,
          },
          update: {
            email,
            emailVerified,
            pictureUrl: googleProfile?.picture ?? null,
          },
        });
      });

      return true;
    },

    /**
     * JWT interno de sesión.
     *
     * Guardamos userId y roles en el token para que la app pueda autorizar
     * sin consultar la base en cada render trivial.
     *
     * Aun así, acciones sensibles deben consultar servidor/DB cuando necesiten
     * validar acceso a entidades específicas.
     */
    async jwt({ token }) {
      const email = token.email?.trim().toLowerCase();

      if (!email) {
        token.roles = [];
        return token;
      }

      const user = await prisma.user.findUnique({
        where: {
          email,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user || !user.activo) {
        token.roles = [];
        return token;
      }

      token.userId = user.id;
      token.name = user.nombre;
      token.picture = user.photoUrl ?? token.picture;
      token.roles = user.roles.map((item) => item.role.code);

      return token;
    },

    /**
     * Sesión expuesta a server/client components.
     *
     * No expone secretos. Solo identidad mínima y roles internos.
     */
    async session({ session, token }) {
      session.user.id = String(token.userId ?? "");
      session.user.roles = Array.isArray(token.roles)
        ? token.roles.map(String)
        : [];

      return session;
    },
  },
};

/**
 * Helper compatible con el resto de la app.
 *
 * Así los guards pueden importar auth() sin acoplarse directamente a
 * getServerSession ni a la versión concreta de NextAuth.
 */
export function auth() {
  return getServerSession(authOptions);
}
