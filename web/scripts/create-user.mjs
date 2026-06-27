import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL no está definida.");
  process.exit(1);
}

const email = process.env.USER_EMAIL?.trim().toLowerCase();
const nombre = process.env.USER_NAME?.trim();
const password = process.env.USER_PASSWORD;
const roleCode = process.env.USER_ROLE?.trim().toUpperCase() ?? "OPERADOR";

if (!email || !nombre || !password) {
  console.error("Faltan USER_EMAIL, USER_NAME o USER_PASSWORD.");
  process.exit(1);
}

const allowedRoles = new Set(["ADMIN", "OPERADOR", "LECTURA"]);

if (!allowedRoles.has(roleCode)) {
  console.error("USER_ROLE debe ser ADMIN, OPERADOR o LECTURA.");
  process.exit(1);
}

function hashPassword(rawPassword) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(rawPassword, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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
      passwordHash: hashPassword(password),
      activo: true,
    },
    update: {
      nombre,
      activo: true,
      passwordHash: hashPassword(password),
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

  console.log(`OK: usuario ${email} creado/actualizado con rol ${roleCode}.`);
} finally {
  await prisma.$disconnect();
}
