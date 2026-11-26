"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/** Session action isolated at the bottom of the sidebar. */
export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => {
      void signOut({ callbackUrl: "/login" });
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-[var(--font-weight-action)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-soft)] disabled:cursor-wait disabled:opacity-60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] group-hover:text-[var(--color-selection-strong)]">
        <LogOut className="h-[1.125rem] w-[1.125rem]" />
      </span>
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
