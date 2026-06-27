"use client";

import { useMemo, useState } from "react";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { resumirCronograma } from "@/domain/creditos/simulador/resumen-cronograma";

import {
  parseDateInputValue,
  parseNumericInput,
  parseTasaMensualInput,
  toDateInputValue,
} from "@/lib/formatters";

import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

import type { SimulationResult, SimulatorFormState } from "../types";

/**
 * Estado inicial del simulador.
 *
 * Decisión de producto:
 * - La fecha del préstamo inicia con la fecha actual.
 * - Los demás campos quedan vacíos para evitar datos simulados incrustados.
 */
export const initialSimulatorFormState: SimulatorFormState = {
  fechaPrestamo: toDateInputValue(new Date()),
  monto: "",
  plazoMeses: "",
  tasaMensual: "",
  frecuencia: "",
  tipoAmortizacion: "",
};

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
 * Hook principal del simulador libre.
 *
 * No persiste datos.
 * No crea clientes.
 * No crea créditos.
 * Solo normaliza entradas y ejecuta el motor financiero puro.
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
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      ...initialSimulatorFormState,
      fechaPrestamo: toDateInputValue(new Date()),
    });
  }

  return {
    form,
    resultado,
    updateField,
    resetForm,
  };
}