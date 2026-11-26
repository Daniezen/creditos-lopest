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
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/90 p-6 shadow-[var(--ds-shadow-overlay)] backdrop-blur">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)] shadow-[var(--ds-shadow-surface)]">
          <Landmark className="h-6 w-6" />
        </div>

        <div>
          <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-selection-strong)]">
            Créditos Lopest
          </p>

          <h1 className="mt-1 text-2xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
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
              className="group block w-full overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--gradient-card)] p-4 text-left shadow-[var(--ds-shadow-surface)] transition hover:-translate-y-0.5 hover:border-[var(--color-border-default)] hover:shadow-[var(--ds-shadow-panel)] disabled:cursor-wait disabled:opacity-70"
              aria-label={`Iniciar sesión como ${profile.label}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--color-surface-primary)] bg-[var(--color-surface-primary)]">
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
                  <div className="flex h-full w-full items-center justify-center bg-[var(--gradient-initials)] text-5xl font-[var(--font-weight-heading)] text-[var(--color-selection-strong)]">
                    {profile.initials}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
                  {profile.label}
                </p>

                <p className="mt-2 text-xs font-[var(--font-weight-label)] text-[var(--color-selection-strong)] opacity-80 transition group-hover:opacity-100">
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
