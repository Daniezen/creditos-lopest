"use client";

import { useActionState } from "react";
import { Landmark, LogIn } from "lucide-react";

import { loginAction, type LoginState } from "@/features/auth/actions";

const initialState: LoginState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <section className="mx-auto w-full max-w-md rounded-[2rem] border border-violet-100 bg-white/90 p-6 shadow-[0_18px_45px_rgba(109,40,217,0.12)] backdrop-blur">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-violet-600 text-white shadow-lg shadow-violet-200">
          <Landmark className="h-7 w-7" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
            Créditos Lopest
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Iniciar sesión
          </h1>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Correo
          </span>

          <input
            name="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Contraseña
          </span>

          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
          />
        </label>

        {state.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <LogIn className="h-4 w-4" />
          {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
