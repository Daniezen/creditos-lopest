/**
 * zod schemas for every Casa y Negocio mutation.
 *
 * Inputs arrive as text (FormData or a client component posting the raw form
 * values), so money uses the shared Colombian parser (`"1.787.000"`), days use
 * `YYYY-MM-DD` and row versions use the shared `rowVersion`. Every schema
 * lives here, free of server imports, so the UI can reuse them for inline
 * validation and Vitest can exercise them directly. The services parse again
 * on the server: the browser copy is a convenience, never the guard.
 *
 * Business rules that need the database (account groups, category class,
 * opening dates) are not here: see `src/server/casa-negocio/rules.ts`.
 */
import { z } from "zod";

import {
  MAX_MONEY_PESOS,
  dateInput,
  entityId,
  moneyInput,
  operationKey,
  parseColombianNumber,
  pastOrTodayDateInput,
  rowVersion,
} from "@/server/validation/input";

// ---------------------------------------------------------------------------
// Enum values (mirrors of the Prisma enums, kept as literals so this module
// does not import @prisma/client into client bundles)
// ---------------------------------------------------------------------------

export const GRUPOS_CUENTA = ["NEGOCIO", "CASA"] as const;
export const TIPOS_CUENTA = ["EFECTIVO", "BANCO", "BILLETERA", "AHORRO"] as const;
export const TIPOS_MOVIMIENTO = [
  "GASTO_NEGOCIO",
  "APORTE",
  "RETIRO_CASA",
  "TRASLADO",
  "GASTO_FIJO",
  "GASTO_VARIABLE",
  "INGRESO_CASA",
] as const;
export const CLASES_GASTO = ["FIJO", "VARIABLE"] as const;
export const PERIODICIDADES = ["MENSUAL", "ANUAL"] as const;
export const CAPACIDADES = ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] as const;
export const CODIGOS_AVISO = [
  "FIJO_VENCIDO_SIN_PAGAR",
  "SOBRE_CERCA_DEL_TOPE",
  "SOBRES_CIERRE_NEGATIVO",
  "CUENTA_SIN_CONTAR",
  "ARQUEO_NO_CUADRA",
  "RETIRO_SUPERA_GANANCIA",
  "MOVIMIENTO_DEJA_SIN_SALDO",
  "CREDITO_SIN_PAGOS",
  "GASTO_ANUAL_PROXIMO",
  "CIERRE_SOBRANTE_SIN_AHORRO",
] as const;

/** Alert rules whose threshold is configurable (spec §5: 2, 4, 8, 9). */
export const AVISOS_CON_UMBRAL: ReadonlySet<(typeof CODIGOS_AVISO)[number]> = new Set([
  "SOBRE_CERCA_DEL_TOPE",
  "CUENTA_SIN_CONTAR",
  "CREDITO_SIN_PAGOS",
  "GASTO_ANUAL_PROXIMO",
]);

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

const FUTURE_MESSAGE = "La fecha no puede ser posterior a hoy.";

/** Optional free text: blank becomes null so the column stays NULL, not "". */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} admite máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : null));
}

function requiredText(max: number, label: string) {
  return z
    .string({ error: `Falta ${label}.` })
    .trim()
    .min(1, `Falta ${label}.`)
    .max(max, `${capitalize(label)} admite máximo ${max} caracteres.`);
}

/** Optional id (`<select>` with an empty "ninguna" option): blank becomes null. */
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(entityId("la cuenta").nullable());

/**
 * Money that may be zero (a counted balance, an opening balance, a goal).
 * Same Colombian parsing as `moneyInput`; negatives are refused because none
 * of these quantities can be negative in the module.
 */
function nonNegativeMoney(label: string) {
  return z
    .string({ error: `Falta ${label}.` })
    .trim()
    .min(1, `Falta ${label}.`)
    .max(32, `${capitalize(label)} no es un valor válido.`)
    .refine((raw) => !/-/.test(raw), { error: `${capitalize(label)} no puede ser negativo.` })
    .refine((raw) => {
      const decimals = raw.replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").split(",")[1];
      return decimals === undefined || decimals.length <= 2;
    }, { error: "El valor admite máximo dos decimales." })
    .transform(parseColombianNumber)
    .refine((value) => Number.isFinite(value) && value >= 0, { error: `${capitalize(label)} no es un valor válido.` })
    .refine((value) => value <= MAX_MONEY_PESOS, { error: "El valor supera el máximo permitido." });
}

/** Optional money (blank = not set). */
function optionalMoney(label: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(nonNegativeMoney(label).optional())
    .transform((value) => (value === undefined ? null : value));
}

/** Integer typed in a text field, within bounds; blank becomes null. */
function optionalInt(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value, context) => {
      if (!value) return null;
      if (!/^\d+$/.test(value)) {
        context.addIssue({ code: "custom", message: `${capitalize(label)} debe ser un número entero.` });
        return z.NEVER;
      }
      const parsed = Number(value);
      if (parsed < min || parsed > max) {
        context.addIssue({ code: "custom", message: `${capitalize(label)} debe estar entre ${min} y ${max}.` });
        return z.NEVER;
      }
      return parsed;
    });
}

/** Checkbox/toggle value as sent by forms and client components. */
const booleanFlag = z
  .union([z.boolean(), z.enum(["true", "false", "on", "off", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "on" || value === "1");

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

const movimientoFields = {
  tipo: z.enum(TIPOS_MOVIMIENTO, { error: "El tipo de movimiento no es válido." }),
  fecha: pastOrTodayDateInput("la fecha", FUTURE_MESSAGE),
  monto: moneyInput({ required: "Falta el monto.", invalid: "El monto debe ser mayor que cero." }),
  cuentaOrigenId: optionalId,
  cuentaDestinoId: optionalId,
  categoriaId: optionalId,
  nota: optionalText(500, "La nota"),
};

export const registrarMovimientoSchema = z.object({
  operationKey,
  ...movimientoFields,
});
export type RegistrarMovimientoInput = z.input<typeof registrarMovimientoSchema>;

export const editarMovimientoSchema = z.object({
  movimientoId: entityId("el movimiento"),
  version: rowVersion,
  ...movimientoFields,
});
export type EditarMovimientoInput = z.input<typeof editarMovimientoSchema>;

export const anularMovimientoSchema = z.object({
  movimientoId: entityId("el movimiento"),
  version: rowVersion,
  motivo: requiredText(300, "el motivo"),
});
export type AnularMovimientoInput = z.input<typeof anularMovimientoSchema>;

/** "Pasar al ahorro": a TRASLADO into the configured savings account. */
export const pasarAlAhorroSchema = z.object({
  operationKey,
  cuentaOrigenId: entityId("la cuenta de origen"),
  monto: moneyInput({ required: "Falta el monto.", invalid: "El monto debe ser mayor que cero." }),
  fecha: pastOrTodayDateInput("la fecha", FUTURE_MESSAGE),
  nota: optionalText(500, "La nota"),
});
export type PasarAlAhorroInput = z.input<typeof pasarAlAhorroSchema>;

// ---------------------------------------------------------------------------
// Automatic movement account assignment
// ---------------------------------------------------------------------------

export const asignarCuentaSchema = z
  .object({
    eventoFinancieroId: optionalId,
    creditoId: optionalId,
    cuentaId: entityId("la cuenta"),
    /** Version of the existing assignment when changing it; absent for the first one. */
    version: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined))
      .pipe(rowVersion.optional()),
  })
  .refine((value) => (value.eventoFinancieroId === null) !== (value.creditoId === null), {
    error: "Indica un cobro o un desembolso, no ambos.",
    path: ["eventoFinancieroId"],
  });
export type AsignarCuentaInput = z.input<typeof asignarCuentaSchema>;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const cuentaFields = {
  nombre: requiredText(60, "el nombre"),
  saldoInicial: nonNegativeMoney("el saldo inicial"),
  fechaSaldoInicial: dateInput("la fecha del saldo inicial"),
  orden: optionalInt("el orden", 0, 999).transform((value) => value ?? 0),
};

export const crearCuentaSchema = z.object({
  ...cuentaFields,
  grupo: z.enum(GRUPOS_CUENTA, { error: "El grupo de la cuenta no es válido." }),
  tipo: z.enum(TIPOS_CUENTA, { error: "El tipo de cuenta no es válido." }),
});
export type CrearCuentaInput = z.input<typeof crearCuentaSchema>;

export const editarCuentaSchema = z.object({
  cuentaId: entityId("la cuenta"),
  version: rowVersion,
  ...cuentaFields,
  tipo: z.enum(TIPOS_CUENTA, { error: "El tipo de cuenta no es válido." }),
});
export type EditarCuentaInput = z.input<typeof editarCuentaSchema>;

export const archivarCuentaSchema = z.object({
  cuentaId: entityId("la cuenta"),
  version: rowVersion,
  archivada: booleanFlag,
});
export type ArchivarCuentaInput = z.input<typeof archivarCuentaSchema>;

// ---------------------------------------------------------------------------
// Household expense categories
// ---------------------------------------------------------------------------

const categoriaFields = {
  nombre: requiredText(60, "el nombre"),
  clase: z.enum(CLASES_GASTO, { error: "La clase del gasto no es válida." }),
  monto: optionalMoney("el monto"),
  periodicidad: z.enum(PERIODICIDADES, { error: "La periodicidad no es válida." }),
  mesAnual: optionalInt("el mes", 1, 12),
  diaPago: optionalInt("el día de pago", 1, 31),
  activa: booleanFlag.optional().transform((value) => value ?? true),
  orden: optionalInt("el orden", 0, 999).transform((value) => value ?? 0),
};

/** Shape rules shared by create and edit (mirror of the migration CHECKs). */
function refineCategoria<T extends { periodicidad: string; mesAnual: number | null; clase: string }>(
  value: T,
  context: z.RefinementCtx,
) {
  if (value.periodicidad === "ANUAL" && value.mesAnual === null) {
    context.addIssue({ code: "custom", path: ["mesAnual"], message: "Un gasto anual necesita el mes en que se paga." });
  }
  if (value.clase === "VARIABLE" && value.periodicidad === "ANUAL") {
    context.addIssue({ code: "custom", path: ["periodicidad"], message: "Un gasto variable tiene tope mensual." });
  }
}

export const crearCategoriaSchema = z
  .object(categoriaFields)
  .superRefine(refineCategoria)
  // A monthly expense never stores a month: drop whatever the form sent.
  .transform((value) => ({ ...value, mesAnual: value.periodicidad === "ANUAL" ? value.mesAnual : null }));
export type CrearCategoriaInput = z.input<typeof crearCategoriaSchema>;

export const editarCategoriaSchema = z
  .object({ categoriaId: entityId("el gasto"), version: rowVersion, ...categoriaFields })
  .superRefine(refineCategoria)
  .transform((value) => ({ ...value, mesAnual: value.periodicidad === "ANUAL" ? value.mesAnual : null }));
export type EditarCategoriaInput = z.input<typeof editarCategoriaSchema>;

// ---------------------------------------------------------------------------
// Arqueo
// ---------------------------------------------------------------------------

export const guardarArqueoSchema = z.object({
  operationKey,
  nota: optionalText(500, "La nota"),
  conteos: z
    .array(z.object({ cuentaId: entityId("la cuenta"), contado: nonNegativeMoney("lo contado") }), {
      error: "Faltan los conteos.",
    })
    .min(1, "Cuenta al menos una cuenta.")
    .max(50, "Demasiadas cuentas en un arqueo.")
    .refine((conteos) => new Set(conteos.map((c) => c.cuentaId)).size === conteos.length, {
      error: "Una cuenta aparece dos veces en el arqueo.",
    }),
});
export type GuardarArqueoInput = z.input<typeof guardarArqueoSchema>;

// ---------------------------------------------------------------------------
// Settings, alert rules and permissions
// ---------------------------------------------------------------------------

export const editarConfiguracionSchema = z.object({
  version: rowVersion,
  metaAsignacionCasa: optionalMoney("la meta para la casa"),
  metaAhorro: optionalMoney("la meta de ahorro"),
  cuentaAhorroId: optionalId,
});
export type EditarConfiguracionInput = z.input<typeof editarConfiguracionSchema>;

export const editarReglaAvisoSchema = z
  .object({
    codigo: z.enum(CODIGOS_AVISO, { error: "El aviso no es válido." }),
    version: rowVersion,
    activa: booleanFlag,
    umbral: optionalInt("el umbral", 1, 3650),
  })
  .superRefine((value, context) => {
    const conUmbral = AVISOS_CON_UMBRAL.has(value.codigo);
    if (conUmbral && value.umbral === null) {
      context.addIssue({ code: "custom", path: ["umbral"], message: "Este aviso necesita un umbral." });
    }
    if (!conUmbral && value.umbral !== null) {
      context.addIssue({ code: "custom", path: ["umbral"], message: "Este aviso no tiene umbral." });
    }
    if (value.codigo === "SOBRE_CERCA_DEL_TOPE" && value.umbral !== null && value.umbral > 100) {
      context.addIssue({ code: "custom", path: ["umbral"], message: "El porcentaje debe estar entre 1 y 100." });
    }
  });
export type EditarReglaAvisoInput = z.input<typeof editarReglaAvisoSchema>;

export const definirCapacidadesSchema = z.object({
  userId: entityId("la persona"),
  capacidades: z
    .array(z.enum(CAPACIDADES, { error: "La capacidad no es válida." }))
    .max(CAPACIDADES.length)
    .transform((list) => [...new Set(list)]),
});
export type DefinirCapacidadesInput = z.input<typeof definirCapacidadesSchema>;

// ---------------------------------------------------------------------------
// Loan write-off ("préstamo perdido")
// ---------------------------------------------------------------------------

export const registrarCastigoSchema = z.object({
  creditoId: entityId("el crédito"),
  monto: moneyInput({ required: "Falta el monto castigado.", invalid: "El monto debe ser mayor que cero." }),
  fecha: pastOrTodayDateInput("la fecha", FUTURE_MESSAGE),
  motivo: requiredText(500, "el motivo"),
});
export type RegistrarCastigoInput = z.input<typeof registrarCastigoSchema>;

export const revertirCastigoSchema = z.object({
  castigoId: entityId("el castigo"),
  version: rowVersion,
  motivo: requiredText(500, "el motivo"),
});
export type RevertirCastigoInput = z.input<typeof revertirCastigoSchema>;

// ---------------------------------------------------------------------------
// Account deletion (only for accounts nothing ever touched)
// ---------------------------------------------------------------------------

export const eliminarCuentaSchema = z.object({
  cuentaId: entityId("la cuenta"),
  version: rowVersion,
});
export type EliminarCuentaInput = z.input<typeof eliminarCuentaSchema>;
