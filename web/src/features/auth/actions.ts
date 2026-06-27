"use server";

import { redirect } from "next/navigation";

/**
 * Ya no usamos login por correo/contraseña interno.
 *
 * El login real ocurre desde el componente cliente usando signIn()
 * de next-auth/react para iniciar Google OAuth.
 */
export async function logoutAction() {
  redirect("/api/auth/signout");
}
