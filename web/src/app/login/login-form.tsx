"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Landmark } from "lucide-react";

interface LoginProfile {
  key: string;
  label: string;
  loginHint?: string;
  imageSrc?: string;
  initials: string;
}

interface LoginFormProps {
  profiles: LoginProfile[];
}

/**
 * Login visual personalizado.
 *
 * La foto/tarjeta es el botón de entrada. No se muestra rol operativo porque
 * para el usuario final no aporta valor y añade ruido visual.
 *
 * Seguridad real:
 * - La tarjeta no autentica.
 * - La tarjeta solo inicia Google OAuth.
 * - Google confirma identidad.
 * - src/auth.ts valida que el correo autenticado exista en users,
 *   esté activo y tenga al menos un rol.
 *
 * Caso de borde cubierto:
 * - Si el usuario abre Google OAuth y luego vuelve atrás/cancela,
 *   el navegador puede restaurar la página con el estado React anterior.
 *   Por eso reseteamos loadingKey al recuperar foco/visibilidad/pageshow.
 */
export function LoginForm({ profiles }: LoginFormProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    function resetLoadingState() {
      setLoadingKey(null);
    }

    window.addEventListener("focus", resetLoadingState);
    window.addEventListener("pageshow", resetLoadingState);
    document.addEventListener("visibilitychange", resetLoadingState);

    return () => {
      window.removeEventListener("focus", resetLoadingState);
      window.removeEventListener("pageshow", resetLoadingState);
      document.removeEventListener("visibilitychange", resetLoadingState);
    };
  }, []);

  function handleLogin(profile: LoginProfile) {
    setLoadingKey(profile.key);

    signIn(
      "google",
      {
        callbackUrl: "/creditos",
      },
      {
        prompt: "select_account",
        ...(profile.loginHint ? { login_hint: profile.loginHint } : {}),
      },
    ).catch(() => {
      /**
       * Fallback defensivo:
       * si NextAuth no logra navegar por error de red/cancelación, la UI
       * no debe quedar bloqueada.
       */
      setLoadingKey(null);
    });
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-violet-100 bg-white/90 p-6 shadow-[0_18px_45px_rgba(109,40,217,0.12)] backdrop-blur">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-violet-600 text-white shadow-lg shadow-violet-200">
          <Landmark className="h-7 w-7" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
            Créditos Lopest
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Selecciona tu acceso
          </h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {profiles.map((profile) => {
          const isLoading = loadingKey === profile.key;

          return (
            <button
              key={profile.key}
              type="button"
              onClick={() => handleLogin(profile)}
              disabled={loadingKey !== null}
              className="group block w-full overflow-hidden rounded-[2rem] border border-violet-100 bg-gradient-to-br from-white via-violet-50/60 to-orange-50/40 p-4 text-left shadow-sm shadow-violet-100/40 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100 disabled:cursor-wait disabled:opacity-70"
              aria-label={`Iniciar sesión como ${profile.label}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white bg-white shadow-inner">
                {profile.imageSrc ? (
                  <Image
                    src={profile.imageSrc}
                    alt={profile.label}
                    fill
                    sizes="(min-width: 768px) 30vw, 90vw"
                    className="object-cover"
                    priority={profile.key === "daniel"}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,#ddd6fe_0%,#f5d0fe_45%,#ffedd5_100%)] text-5xl font-black text-violet-700">
                    {profile.initials}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xl font-black tracking-tight text-slate-950">
                  {profile.label}
                </p>

                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-700 opacity-80 transition group-hover:text-fuchsia-700">
                  {isLoading ? "Abriendo Google..." : "Cuenta Google"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
