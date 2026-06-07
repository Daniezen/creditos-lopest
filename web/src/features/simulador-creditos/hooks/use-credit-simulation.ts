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

/**
 * Estado inicial deliberadamente vacío.
 *
 * Decisión de producto:
 * - El simulador libre no debe arrancar con datos inventados.
 * - El usuario debe ingresar las condiciones financieras.
 * - Si faltan datos, se muestra un estado vacío neutral, no un error.
 */
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
 * Este guard convierte el valor visual del formulario en una frecuencia válida
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

/**
 * El formulario permite "" para representar el placeholder vacío.
 * El dominio financiero solo acepta tipos reales de amortización.
 */
function isTipoAmortizacion(
  value: SimulatorFormState["tipoAmortizacion"],
): value is TipoAmortizacion {
  return value === "Amortización Fija" || value === "Solo Interés";
}

/**
 * Hook principal del simulador libre.
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
 * - Crear clientes.
 * - Crear créditos.
 * - Conocer rutas de Next.
 *
 * El flujo de creación real vivirá después en /creditos/nuevo y reutilizará
 * el motor financiero y componentes visuales, pero con cliente y persistencia.
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
     * Guard directo.
     *
     * No se debe esconder esta validación en booleanos intermedios si luego se
     * necesita que TypeScript estreche el tipo. Después de este return,
     * TypeScript entiende que form.frecuencia ya no puede ser "".
     */
    if (!isFrecuenciaPago(form.frecuencia)) {
      return {
        estado: "empty",
        cronograma: [],
        resumen: null,
        error: null,
      };
    }

    /**
     * Después de este return, TypeScript entiende que form.tipoAmortizacion
     * ya no puede ser "".
     */
    if (!isTipoAmortizacion(form.tipoAmortizacion)) {
      return {
        estado: "empty",
        cronograma: [],
        resumen: null,
        error: null,
      };
    }

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
         *
         * Más adelante puede exponerse como campo "fecha de evaluación" si se
         * necesita simular mora proyectada contra una fecha específica.
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
       * Esto debe ser una propiedad computada.
       *
       * Correcto:
       *   [field]: value
       *
       * Incorrecto:
       *   value
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