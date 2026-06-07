
/**
 * Utilidades de formato para la interfaz.
 *
 * Este archivo no contiene lógica financiera.
 * Solo convierte números y fechas a representaciones legibles para usuarios.
 */

export function formatCurrencyCOP(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "$0";
  }

  const rounded = Math.round(value * 100) / 100;

  return `$${rounded.toLocaleString("es-CO", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumberCO(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("es-CO", {
    maximumFractionDigits: 4,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0%";
  }

  const percent = value * 100;

  return `${percent.toLocaleString("es-CO", {
    minimumFractionDigits: Number.isInteger(percent) ? 0 : 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatDateCO(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Convierte un Date a formato compatible con input[type="date"].
 *
 * No usamos toISOString() porque convierte a UTC y puede mover el día según zona horaria.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Lee un valor yyyy-mm-dd desde input[type="date"] como fecha local.
 *
 * Evita new Date("yyyy-mm-dd"), porque ese parser puede interpretarse como UTC.
 */
export function parseDateInputValue(value: string): Date {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  return new Date(year, month - 1, day);
}

/**
 * Convierte texto numérico en número aceptando formato colombiano básico.
 *
 * Ejemplos:
 * - "300000" => 300000
 * - "300.000" => 300000
 * - "300,5" => 300.5
 * - "$300.000" => 300000
 */
export function parseNumericInput(value: string): number {
  const cleaned = value
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * Normaliza la tasa mensual usando la regla heredada de Apps Script.
 *
 * Casos:
 * - "20%" => 0.2
 * - "20"  => 0.2
 * - "0.2" => 0.2
 * - "0,2" => 0.2
 */
export function parseTasaMensualInput(value: string): number {
  const raw = value.trim().replace(",", ".");
  const withoutPercent = raw.replace("%", "");
  const parsed = Number(withoutPercent);

  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  if (raw.includes("%")) {
    return parsed / 100;
  }

  if (parsed > 1) {
    return parsed / 100;
  }

  return parsed;
}