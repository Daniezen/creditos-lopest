import { describe, expect, it } from "vitest";

import { generarCronogramaSimulado } from "../calcular-cronograma";
import { resumirCronograma } from "../resumen-cronograma";

import type { EntradaSimuladorCredito } from "../tipos";

/**
 * Crea fechas locales sin depender del parser ambiguo de strings.
 *
 * No usar new Date("2026-03-15") en estos tests porque puede introducir
 * desplazamientos UTC/locales dependiendo del runtime.
 */
function fechaLocal(anio: number, mes: number, dia: number): Date {
  return new Date(anio, mes - 1, dia);
}

/**
 * Convierte una fecha a una clave estable yyyy-mm-dd para comparar.
 */
function claveFecha(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

/**
 * Compara números financieros con tolerancia pequeña.
 *
 * Motivo:
 * JavaScript usa aritmética binaria de punto flotante. No se debe comparar
 * dinero calculado con igualdad estricta cuando hay divisiones.
 */
function esperarNumeroCercano(actual: number, esperado: number): void {
  expect(actual).toBeCloseTo(esperado, 6);
}

describe("generarCronogramaSimulado - amortización fija", () => {
  it("replica LP-26-0003: Quincenal 15/30, 400000, 4 meses, 20%", () => {
    const entrada: EntradaSimuladorCredito = {
      idCredito: "LP-26-0003",
      cliente: "Cristian Camilo Misas Betancur",
      cedula: "1001901609",
      fechaPrestamo: fechaLocal(2025, 12, 2),
      monto: 400_000,
      plazoMeses: 4,
      tasaMensual: 0.2,
      frecuencia: "Quincenal 15/30",
      tipoAmortizacion: "Amortización Fija",

      /**
       * Fijamos la fecha de referencia para no depender del día actual.
       * En el CSV, estas cuotas nacen en el pasado respecto a 2026-06-01.
       */
      fechaReferencia: fechaLocal(2026, 6, 1),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(8);

    expect(cuotas.map((cuota) => claveFecha(cuota.fechaProgramada))).toEqual([
      "2025-12-15",
      "2025-12-31",
      "2026-01-15",
      "2026-01-31",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
      "2026-03-31",
    ]);

    for (const cuota of cuotas) {
      esperarNumeroCercano(cuota.valorCuota, 90_000);
      esperarNumeroCercano(cuota.capitalProgramado, 50_000);
      esperarNumeroCercano(cuota.interesProgramado, 40_000);
    }

    expect(cuotas.map((cuota) => cuota.saldoCapitalPost)).toEqual([
      350_000,
      300_000,
      250_000,
      200_000,
      150_000,
      100_000,
      50_000,
      0,
    ]);
  });

  it("replica LP-26-0001: Quincenal 15/30, 300000, 3 meses, 20%", () => {
    const entrada: EntradaSimuladorCredito = {
      idCredito: "LP-26-0001",
      cliente: "Juan Guillermo Villada Ramirez",
      cedula: "3349693",
      fechaPrestamo: fechaLocal(2026, 3, 2),
      monto: 300_000,
      plazoMeses: 3,
      tasaMensual: 0.2,
      frecuencia: "Quincenal 15/30",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 6, 1),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(6);

    expect(cuotas.map((cuota) => claveFecha(cuota.fechaProgramada))).toEqual([
      "2026-03-15",
      "2026-03-31",
      "2026-04-15",
      "2026-04-30",
      "2026-05-15",
      "2026-05-31",
    ]);

    for (const cuota of cuotas) {
      esperarNumeroCercano(cuota.valorCuota, 80_000);
      esperarNumeroCercano(cuota.capitalProgramado, 50_000);
      esperarNumeroCercano(cuota.interesProgramado, 30_000);
    }

    expect(cuotas.map((cuota) => cuota.saldoCapitalPost)).toEqual([
      250_000,
      200_000,
      150_000,
      100_000,
      50_000,
      0,
    ]);
  });

  it("calcula frecuencia mensual con pago al fin de mes", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2026, 3, 14),
      monto: 300_000,
      plazoMeses: 1,
      tasaMensual: 0.2,
      frecuencia: "Mensual",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 3, 15),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(1);
    expect(claveFecha(cuotas[0].fechaProgramada)).toBe("2026-04-30");

    esperarNumeroCercano(cuotas[0].capitalProgramado, 300_000);
    esperarNumeroCercano(cuotas[0].interesProgramado, 60_000);
    esperarNumeroCercano(cuotas[0].valorCuota, 360_000);
    esperarNumeroCercano(cuotas[0].saldoCapitalPost, 0);
  });

  it("aplica regla de salto mensual cuando faltan <= 6 días para fin de mes", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2026, 3, 26),

      monto: 300_000,
      plazoMeses: 1,
      tasaMensual: 0.2,

      frecuencia: "Mensual",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 3, 26),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(1);

    /**
     * 26/03 a 31/03 son 6 días inclusivos.
     * Por regla heredada, se salta abril y paga al fin de mayo.
     */
    expect(claveFecha(cuotas[0].fechaProgramada)).toBe("2026-05-31");
  });
});

describe("generarCronogramaSimulado - calendarios quincenales", () => {
  it("calcula Quincenal 5/20 con cortes 5 y 20", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2025, 12, 20),

      monto: 400_000,
      plazoMeses: 4,
      tasaMensual: 0.2,

      frecuencia: "Quincenal 5/20",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 5, 1),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(8);

    expect(cuotas.map((cuota) => claveFecha(cuota.fechaProgramada))).toEqual([
      "2026-01-05",
      "2026-01-20",
      "2026-02-05",
      "2026-02-20",
      "2026-03-05",
      "2026-03-20",
      "2026-04-05",
      "2026-04-20",
    ]);

    for (const cuota of cuotas) {
      esperarNumeroCercano(cuota.capitalProgramado, 50_000);
      esperarNumeroCercano(cuota.interesProgramado, 40_000);
      esperarNumeroCercano(cuota.valorCuota, 90_000);
    }
  });

  it("calcula Quincenal 10/25 con cortes 10 y 25", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2025, 9, 16),

      monto: 500_000,
      plazoMeses: 5,
      tasaMensual: 0.1345,

      frecuencia: "Quincenal 10/25",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 1, 1),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(10);

    expect(cuotas.map((cuota) => claveFecha(cuota.fechaProgramada))).toEqual([
      "2025-09-25",
      "2025-10-10",
      "2025-10-25",
      "2025-11-10",
      "2025-11-25",
      "2025-12-10",
      "2025-12-25",
      "2026-01-10",
      "2026-01-25",
      "2026-02-10",
    ]);

    for (const cuota of cuotas) {
      esperarNumeroCercano(cuota.capitalProgramado, 50_000);
      esperarNumeroCercano(cuota.interesProgramado, 33_625);
      esperarNumeroCercano(cuota.valorCuota, 83_625);
    }
  });

  it("aplica regla de salto quincenal cuando faltan <= 6 días para el corte", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2026, 3, 10),

      monto: 300_000,
      plazoMeses: 1,
      tasaMensual: 0.2,

      frecuencia: "Quincenal 15/30",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 3, 10),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(2);

    /**
     * 10/03 a 15/03 son 6 días inclusivos.
     * Por regla heredada, salta al siguiente corte: 31/03.
     */
    expect(claveFecha(cuotas[0].fechaProgramada)).toBe("2026-03-31");
    expect(claveFecha(cuotas[1].fechaProgramada)).toBe("2026-04-15");
  });
});

describe("generarCronogramaSimulado - solo interés", () => {
  it("calcula Solo Interés mensual con capital al final", () => {
    const entrada: EntradaSimuladorCredito = {
      fechaPrestamo: fechaLocal(2026, 2, 20),

      monto: 400_000,
      plazoMeses: 4,
      tasaMensual: 0.2,

      frecuencia: "Mensual",
      tipoAmortizacion: "Solo Interés",
      fechaReferencia: fechaLocal(2026, 2, 20),
    };

    const cuotas = generarCronogramaSimulado(entrada);

    expect(cuotas).toHaveLength(4);

    expect(cuotas.map((cuota) => claveFecha(cuota.fechaProgramada))).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);

    esperarNumeroCercano(cuotas[0].capitalProgramado, 0);
    esperarNumeroCercano(cuotas[0].interesProgramado, 80_000);
    esperarNumeroCercano(cuotas[0].valorCuota, 80_000);
    esperarNumeroCercano(cuotas[0].saldoCapitalPost, 400_000);

    esperarNumeroCercano(cuotas[3].capitalProgramado, 400_000);
    esperarNumeroCercano(cuotas[3].interesProgramado, 80_000);
    esperarNumeroCercano(cuotas[3].valorCuota, 480_000);
    esperarNumeroCercano(cuotas[3].saldoCapitalPost, 0);
  });
});

describe("resumirCronograma", () => {
  it("calcula totales del cronograma", () => {
    const cuotas = generarCronogramaSimulado({
      fechaPrestamo: fechaLocal(2025, 12, 2),
      monto: 400_000,
      plazoMeses: 4,
      tasaMensual: 0.2,
      frecuencia: "Quincenal 15/30",
      tipoAmortizacion: "Amortización Fija",
      fechaReferencia: fechaLocal(2026, 6, 1),
    });

    const resumen = resumirCronograma(cuotas);

    expect(resumen.numeroCuotas).toBe(8);
    esperarNumeroCercano(resumen.totalCapital, 400_000);
    esperarNumeroCercano(resumen.totalInteres, 320_000);
    esperarNumeroCercano(resumen.totalPagar, 720_000);
    esperarNumeroCercano(resumen.valorPromedioCuota, 90_000);

    expect(resumen.fechaPrimeraCuota && claveFecha(resumen.fechaPrimeraCuota)).toBe(
      "2025-12-15",
    );
    expect(resumen.fechaUltimaCuota && claveFecha(resumen.fechaUltimaCuota)).toBe(
      "2026-03-31",
    );
  });
});