import ExcelJS from "exceljs";

import { matchesCreditFilters, type CreditFacetFilters, type CreditFacetSource } from "./credit-facets";
import { derivarCreditoOperativo } from "./portfolio-summary";

const MONEY_FORMAT = '"$"#,##0.00';
const DATE_FORMAT = "dd/mm/yyyy";

export interface CreditExportResult {
  buffer: Buffer;
  fileName: string;
  creditCount: number;
  installmentCount: number;
}

/** Returns every authorized credit matching the same filters used by the screen. */
export function seleccionarCreditosParaExportacion(
  credits: CreditFacetSource[],
  filters: CreditFacetFilters,
): CreditFacetSource[] {
  return credits.filter((credit) => matchesCreditFilters(credit, filters));
}

/** Pure workbook builder kept separate so report structure is testable without a database. */
export async function construirReporteExcelCreditos(
  credits: CreditFacetSource[],
  filters: CreditFacetFilters,
  generatedBy: string,
  now: Date,
): Promise<CreditExportResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Créditos Lopest";
  workbook.created = now;
  workbook.modified = now;

  const rows = credits.map((credit) => {
    const operational = derivarCreditoOperativo(credit);
    const overdue = credit.eventos.filter(
      (event) => event.tipo === "CUOTA_PROGRAMADA" && (event.estado === "ATRASADO" || event.estado === "MORA"),
    );
    return { credit, operational, overdue };
  });
  const installments = rows.flatMap(({ credit, overdue }) =>
    overdue.map((event) => ({ credit, event })),
  );
  const overdueInterest = installments.reduce((total, row) => total + money(row.event.interesProgramado), 0);
  const overdueValue = installments.reduce((total, row) => total + money(row.event.valorProgramado), 0);
  const oldest = installments
    .map((row) => row.event.fechaProgramada)
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

  const summary = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.columns = [{ width: 34 }, { width: 42 }];
  summary.addRows([
    ["Reporte", "Resultados de créditos"],
    ["Generado", now],
    ["Generado por", generatedBy || "Usuario autenticado"],
    ["Filtros", describeFilters(filters)],
    ["Créditos exportados", credits.length],
    ["Cuotas atrasadas", installments.length],
    ["Capital pendiente", rows.reduce((total, row) => total + row.operational.saldoCapital, 0)],
    ["Interés vencido", overdueInterest],
    ["Valor total vencido", overdueValue],
    ["Cuota vencida más antigua", oldest],
  ]);
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
  for (const row of [7, 8, 9]) summary.getCell(row, 2).numFmt = MONEY_FORMAT;
  summary.getCell(2, 2).numFmt = "dd/mm/yyyy hh:mm";
  summary.getCell(10, 2).numFmt = DATE_FORMAT;

  const creditsSheet = workbook.addWorksheet("Créditos", { views: [{ state: "frozen", ySplit: 1 }] });
  creditsSheet.columns = [
    { header: "Código", key: "codigo", width: 16 },
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Cédula", key: "cedula", width: 18 },
    { header: "Teléfono", key: "telefono", width: 18 },
    { header: "Cuotas atrasadas", key: "cuotas", width: 18 },
    { header: "Vencida más antigua", key: "antigua", width: 20 },
    { header: "Máximo días atraso", key: "dias", width: 20 },
    { header: "Monto original", key: "monto", width: 18 },
    { header: "Capital pendiente", key: "capital", width: 20 },
    { header: "Interés vencido", key: "interes", width: 18 },
    { header: "Valor vencido", key: "vencido", width: 18 },
    { header: "Detalle", key: "detalle", width: 36 },
  ];
  for (const { credit, operational, overdue } of rows) {
    const row = creditsSheet.addRow({
      codigo: credit.codigo,
      cliente: credit.cliente.nombre,
      cedula: credit.cliente.cedula,
      telefono: credit.cliente.telefono ?? "",
      cuotas: overdue.length,
      antigua: overdue[0]?.fechaProgramada ?? null,
      dias: Math.max(0, ...overdue.map((event) => event.diasAtraso ?? 0)),
      monto: credit.monto,
      capital: operational.saldoCapital,
      interes: overdue.reduce((total, event) => total + money(event.interesProgramado), 0),
      vencido: overdue.reduce((total, event) => total + money(event.valorProgramado), 0),
      detalle: { text: `/creditos/${credit.id}`, hyperlink: `/creditos/${credit.id}` },
    });
    row.getCell("antigua").numFmt = DATE_FORMAT;
    for (const key of ["monto", "capital", "interes", "vencido"]) row.getCell(key).numFmt = MONEY_FORMAT;
  }
  styleHeader(creditsSheet);
  creditsSheet.autoFilter = { from: "A1", to: "L1" };

  const installmentsSheet = workbook.addWorksheet("Cuotas atrasadas", { views: [{ state: "frozen", ySplit: 1 }] });
  installmentsSheet.columns = [
    { header: "Código crédito", key: "codigo", width: 18 },
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Cédula", key: "cedula", width: 18 },
    { header: "Teléfono", key: "telefono", width: 18 },
    { header: "Número cuota", key: "numero", width: 16 },
    { header: "Fecha programada", key: "fecha", width: 20 },
    { header: "Días atraso", key: "dias", width: 15 },
    { header: "Capital programado", key: "capital", width: 20 },
    { header: "Interés programado", key: "interes", width: 20 },
    { header: "Valor programado", key: "valor", width: 20 },
    { header: "Estado", key: "estado", width: 14 },
  ];
  for (const { credit, event } of installments) {
    const row = installmentsSheet.addRow({
      codigo: credit.codigo,
      cliente: credit.cliente.nombre,
      cedula: credit.cliente.cedula,
      telefono: credit.cliente.telefono ?? "",
      numero: event.numeroCuota,
      fecha: event.fechaProgramada,
      dias: event.diasAtraso ?? 0,
      capital: money(event.capitalProgramado),
      interes: money(event.interesProgramado),
      valor: money(event.valorProgramado),
      estado: event.estado,
    });
    row.getCell("fecha").numFmt = DATE_FORMAT;
    for (const key of ["capital", "interes", "valor"]) row.getCell(key).numFmt = MONEY_FORMAT;
  }
  styleHeader(installmentsSheet);
  installmentsSheet.autoFilter = { from: "A1", to: "K1" };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const date = colombiaDateParts(now).join("-");
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: `creditos-filtrados-${date}.xlsx`,
    creditCount: credits.length,
    installmentCount: installments.length,
  };
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
  row.alignment = { vertical: "middle" };
}

function describeFilters(filters: CreditFacetFilters): string {
  const applied = [
    filters.query ? `Búsqueda: ${filters.query}` : "",
    filters.segmento !== "TODOS" ? `Estado: ${filters.segmento}` : "",
    filters.cuotasAtrasadas.length ? `Cuotas atrasadas: ${filters.cuotasAtrasadas.join(", ")}` : "",
    filters.codigos.length ? `Códigos: ${filters.codigos.join(", ")}` : "",
    filters.clientes.length ? `Clientes: ${filters.clientes.length}` : "",
  ].filter(Boolean);
  return applied.length ? applied.join(" · ") : "Sin filtros; se exportaron todos los créditos autorizados";
}

function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function colombiaDateParts(date: Date): string[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value ?? "00");
}
