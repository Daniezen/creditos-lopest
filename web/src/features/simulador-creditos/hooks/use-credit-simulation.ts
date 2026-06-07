"use client";

import { useMemo, useState } from "react";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { resumirCronograma } from "@/domain/creditos/simulador/resumen-cronograma";

import {
  parseDateInputValue,
  parseNumericInput,
  parseTasaMensualInput,
} from "@/lib/formatters";

import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

import type { SimulationResult, SimulatorFormState } from "../types";

export const initialSimulatorFormState: SimulatorFormState = {
  fechaPrestamo: "",
  monto: "",
  plazoMeses: "",
  tasaMensual: "",
  frecuencia: "",
  tipoAmortizacion: "",
};

/**
 * El formulario permite "" para representar campos no seleccionados.
 * El dominio financiero NO permite "".
 *
 * Estos guards convierten valores visuales del formulario en valores válidos
 * del dominio antes de invocar el motor financiero.
 */
function isFrecuenciaPago(
  value: SimulatorFormState["frecuencia"],
): value is FrecuenciaPago {
  return (
    value === "Mensual" ||
    value === "Quincenal 15/30" ||
    value === "Quincenal 5/20" ||
    value === "Quincenal 10/25"
  );
}

function isTipoAmortizacion(
  value: SimulatorFormState["tipoAmortizacion"],
): value is TipoAmortizacion {
  return value === "Amortización Fija" || value === "Solo Interés";
}

/**
 * Hook principal del simulador.
 *
 * Responsabilidad:
 * - Manejar estado del formulario.
 * - Validar que la UI tenga datos mínimos.
 * - Normalizar entradas.
 * - Invocar el motor financiero puro.
 * - Exponer resultado de simulación.
 *
 * No debe:
 * - Persistir en base de datos.
 * - Llamar Prisma.
 * - Conocer rutas de Next.
 */
export function useCreditSimulation() {
  const [form, setForm] = useState<SimulatorFormState>(
    initialSimulatorFormState,
  );

  const resultado = useMemo<SimulationResult>(() => {
    const tieneCamposTextoRequeridos =
      form.fechaPrestamo.trim() !== "" &&
      form.monto.trim() !== "" &&
      form.plazoMeses.trim() !== "" &&
      form.tasaMensual.trim() !== "";

    if (!tieneCamposTextoRequeridos) {
      return {
        estado: "empty",
        cronograma: [],
        resumen: null,
        error: null,
      };
    }

    /**
     * Guard directo. No lo escondas en booleanos intermedios.
     * Así TypeScript entiende que, después de estos returns,
     * los valores ya no pueden ser "".
     */
    if (!isFrecuenciaPago(form.frecuencia)) {
      return {
        estado: "empty",
        cronograma: [],
        resumen: null,
        error: null,
      };
    }

    if (!isTipoAmortizacion(form.tipoAmortizacion)) {
      return {
        estado: "empty",
        cronograma: [],
        resumen: null,
        error: null,
      };
    }

    /**
     * En este punto TypeScript ya entiende:
     * - form.frecuencia: FrecuenciaPago
     * - form.tipoAmortizacion: TipoAmortizacion
     */
    const frecuencia: FrecuenciaPago = form.frecuencia;
    const tipoAmortizacion: TipoAmortizacion = form.tipoAmortizacion;

    try {
      const fechaPrestamo = parseDateInputValue(form.fechaPrestamo);
      const monto = parseNumericInput(form.monto);
      const plazoMeses = parseNumericInput(form.plazoMeses);
      const tasaMensual = parseTasaMensualInput(form.tasaMensual);

      const cronograma = generarCronogramaSimulado({
        fechaPrestamo,
        monto,
        plazoMeses,
        tasaMensual,
        frecuencia,
        tipoAmortizacion,

        /**
         * Fecha explícita para que el motor no dependa de tiempo oculto.
         * Más adelante puede exponerse como campo "fecha de evaluación".
         */
        fechaReferencia: new Date(),
      });

      return {
        estado: "success",
        cronograma,
        resumen: resumirCronograma(cronograma),
        error: null,
      };
    } catch (error) {
      return {
        estado: "error",
        cronograma: [],
        resumen: null,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido al calcular la simulación.",
      };
    }
  }, [form]);

  function updateField<K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) {
    setForm((current) => ({
      ...current,

      /**
       * CRÍTICO:
       * Debe ser [field]: value.
       *
       * Si se escribe solo "value", React agrega una propiedad literal llamada
       * "value" y NO actualiza "monto", "plazoMeses", "frecuencia", etc.
       */
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialSimulatorFormState);
  }

  return {
    form,
    resultado,
    updateField,
    resetForm,
  };
}