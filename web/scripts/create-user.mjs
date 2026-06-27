import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

/**
 * Script operativo para preautorizar usuarios OAuth.
 *
 * Intención:
 * - Google autentica identidad.
 * - Esta tabla interna decide si ese email puede entrar y con qué rol.
 *
 * Restricción:
 * - No crea cuentas Google.
 * - No guarda contraseñas.
 * - Solo registra usuarios autorizados dentro de la app.
 *
 * Variables requeridas:
 * - DATABASE_URL
 * - USER_EMAIL
 * - USER_NAME
 * - USER_ROLE: ADMIN | OPERADOR | LECTURA
 *
 * Variable opcional:
 * - USER_PHOTO_URL
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL no está definida.");
  process.exit(1);
}

const email = process.env.USER_EMAIL?.trim().toLowerCase();
const nombre = process.env.USER_NAME?.trim();
const roleCode = process.env.USER_ROLE?.trim().toUpperCase() ?? "OPERADOR";
const photoUrl = process.env.USER_PHOTO_URL?.trim() || null;

if (!email || !nombre) {
  console.error("Faltan USER_EMAIL o USER_NAME.");
  process.exit(1);
}

const allowedRoles = new Set(["ADMIN", "OPERADOR", "LECTURA"]);

if (!allowedRoles.has(roleCode)) {
  console.error("USER_ROLE debe ser ADMIN, OPERADOR o LECTURA.");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

try {
  await prisma.role.upsert({
    where: { code: "ADMIN" },
    create: { code: "ADMIN", name: "Administrador" },
    update: { name: "Administrador" },
  });

  await prisma.role.upsert({
    where: { code: "OPERADOR" },
    create: { code: "OPERADOR", name: "Operador" },
    update: { name: "Operador" },
  });

  await prisma.role.upsert({
    where: { code: "LECTURA" },
    create: { code: "LECTURA", name: "Lectura" },
    update: { name: "Lectura" },
  });

  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      nombre,
      passwordHash: null,
      photoUrl,
      activo: true,
    },
    update: {
      nombre,
      photoUrl,
      activo: true,
      passwordHash: null,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      userId: user.id,
      roleId: role.id,
    },
    update: {},
  });

  console.log(`OK: usuario OAuth ${email} creado/actualizado con rol ${roleCode}.`);
} finally {
  await prisma.$disconnect();
}
