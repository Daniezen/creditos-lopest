"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroyCurrentSession } from "@/server/auth/session";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Correo y contraseña son obligatorios.",
    };
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
    return {
      error: "Credenciales inválidas.",
    };
  }

  const validPassword = verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return {
      error: "Credenciales inválidas.",
    };
  }

  await createSession(user.id);

  redirect("/creditos");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}
