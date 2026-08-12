import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { CreditFacetFilters, CreditFacetSource } from "../credit-facets";
import { construirReporteExcelCreditos, seleccionarCreditosParaExportacion } from "../credit-export";

const filters: CreditFacetFilters = {
  query: "", segmento: "TODOS", codigos: [], clientes: [], cuotasAtrasadas: [1, 3],
  montos: [], montoMin: null, montoMax: null, capitales: [], capitalMin: null, capitalMax: null,
  intereses: [], interesMin: null, interesMax: null, proximaFechaDesde: null, proximaFechaHasta: null,
  proximaValorMin: null, proximaValorMax: null, sinProximaCuota: false, tasas: [], tasaMin: null, tasaMax: null,
};

const credit: CreditFacetSource = {
  id: "c1", codigo: "LP-1", estado: "ACTIVO", creadoEn: new Date("2026-08-01"),
  fechaPrestamo: new Date("2026-01-01"), fechaCancelacion: null, monto: 100000, plazoMeses: 3,
  tasaMensual: 0.1, frecuencia: "MENSUAL", tipoAmortizacion: "AMORTIZACION_FIJA",
  cliente: { id: "p1", nombre: "Cliente Uno", cedula: "123", telefono: "3000000000" },
  eventos: [{ numeroCuota: 1, tipo: "CUOTA_PROGRAMADA", estado: "ATRASADO", fechaProgramada: new Date("2026-07-01T12:00:00"), valorProgramado: 40000, capitalProgramado: 30000, interesProgramado: 10000, diasAtraso: 42, capitalPagado: 0, saldoCapitalPost: 70000 }],
};

describe("exportación Excel de resultados", () => {
  it("genera las tres hojas con importes y atraso persistido", async () => {
    const result = await construirReporteExcelCreditos([credit], filters, "Daniel", new Date("2026-08-12T18:00:00Z"));
    const workbook = new ExcelJS.Workbook();
    const workbookData = result.buffer.buffer.slice(
      result.buffer.byteOffset,
      result.buffer.byteOffset + result.buffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(workbookData);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Resumen", "Créditos", "Cuotas atrasadas"]);
    expect(result.creditCount).toBe(1);
    expect(result.installmentCount).toBe(1);
    expect(workbook.getWorksheet("Cuotas atrasadas")?.getRow(2).getCell(7).value).toBe(42);
    expect(workbook.getWorksheet("Cuotas atrasadas")?.getRow(2).getCell(10).value).toBe(40000);
    expect(result.fileName).toBe("creditos-filtrados-2026-08-12.xlsx");
  });

  it("sin filtros conserva todos los créditos autorizados", () => {
    const cancelled = { ...credit, id: "c2", codigo: "LP-2", estado: "CANCELADO" as const, eventos: [] };
    const current = { ...credit, id: "c3", codigo: "LP-3", eventos: [] };
    const selected = seleccionarCreditosParaExportacion([credit, cancelled, current], {
      ...filters,
      cuotasAtrasadas: [],
    });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-1", "LP-2", "LP-3"]);
  });

  it("exporta únicamente cancelados cuando ese estado está activo", () => {
    const cancelled = { ...credit, id: "c2", codigo: "LP-2", estado: "CANCELADO" as const, eventos: [] };
    const selected = seleccionarCreditosParaExportacion([credit, cancelled], {
      ...filters,
      segmento: "CANCELADO",
      cuotasAtrasadas: [],
    });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-2"]);
  });

  it("respeta múltiples cantidades exactas de cuotas atrasadas", () => {
    const three = {
      ...credit,
      id: "c3",
      codigo: "LP-3",
      eventos: Array.from({ length: 3 }, (_, index) => ({
        ...credit.eventos[0], numeroCuota: index + 1,
      })),
    };
    const two = {
      ...credit,
      id: "c2",
      codigo: "LP-2",
      eventos: Array.from({ length: 2 }, (_, index) => ({
        ...credit.eventos[0], numeroCuota: index + 1,
      })),
    };
    const selected = seleccionarCreditosParaExportacion([credit, two, three], {
      ...filters,
      cuotasAtrasadas: [1, 3],
    });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-1", "LP-3"]);
  });

});
