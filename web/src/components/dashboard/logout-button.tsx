"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/**
 * Acción inferior del sidebar.
 *
 * Se parece estructuralmente a “Volver a Conecta” de Impulsa, pero cumple una
 * función distinta: cerrar sesión OAuth y volver a /login.
 */
export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => {
      void signOut({
        callbackUrl: "/login",
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-violet-950 transition hover:bg-violet-50 hover:text-violet-700 disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut className="h-5 w-5" />
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
