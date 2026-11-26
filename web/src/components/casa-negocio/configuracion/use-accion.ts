"use client";

import { useCallback, useState, useTransition } from "react";

import type { ResultadoAccion } from "@/server/casa-negocio/vista-configuracion";

/**
 * Runs a Configuración Server Action inside a transition and keeps its
 * inline error. The action revalidates the module, so on success the page's
 * fresh data (with new row versions) arrives in the same round trip; on
 * failure the error stays next to what failed until the next attempt.
 */
export function useAccion() {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});

  const ejecutar = useCallback(
    (accion: () => Promise<ResultadoAccion>, alTerminar?: () => void) => {
      setError(null);
      setCampos({});
      startTransition(async () => {
        let resultado: ResultadoAccion;
        try {
          resultado = await accion();
        } catch {
          // Network failure or a server crash outside the action's own catch.
          resultado = { ok: false, error: "No hubo conexión con el servidor. Inténtalo de nuevo." };
        }
        if (resultado.ok) alTerminar?.();
        else {
          setError(resultado.error);
          setCampos(resultado.campos ?? {});
        }
      });
    },
    [],
  );

  const limpiar = useCallback(() => {
    setError(null);
    setCampos({});
  }, []);

  return { pendiente, error, campos, ejecutar, limpiar };
}
