/**
 * Shared zod building blocks for every Server Action and Route Handler that
 * receives user input.
 *
 * WHY A SHARED MODULE. Before zod, each action re-implemented its own
 * `leerCampoObligatorio`, money parser and `YYYY-MM-DD` parser. They agreed on
 * the happy path but diverged on the edges (one accepted `2026-02-30` and
 * silently rolled it to March, another rejected it). The primitives below are
 * the single definition of "a valid id", "a valid amount" and "a valid
 * calendar date" for Lopest, and every feature schema composes them.
 *
 * BEHAVIOUR CONTRACT. For inputs the old code accepted as valid, the parsed
 * output is byte-for-byte what the old helpers produced (same trimming, same
 * Colombian money parsing, same local-midnight dates). The schemas only add
 * rejections for inputs that were never meaningful: empty ids, amounts with
 * more than two decimals or beyond float precision, impossible dates, oversized
 * text.
 *
 * This file must stay free of server-only imports (Prisma, next/headers) so
 * Vitest can exercise it directly and feature schemas can import it anywhere.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** One message per offending field, keyed by the first segment of the issue path. */
export type FieldErrors = Record<string, string>;

/**
 * Raised when an input fails its schema. `message` is the first issue's text so
 * the existing UIs, which only render a single string, keep showing a precise
 * reason; `fieldErrors` lets forms that support it mark each field.
 */
export class InputValidationError extends Error {
  readonly fieldErrors: FieldErrors;

  constructor(error: z.ZodError) {
    const fieldErrors = toFieldErrors(error);
    super(error.issues[0]?.message ?? "Los datos enviados no son válidos.");
    this.name = "InputValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Collapses zod issues into `{ field: message }`, keeping only the first issue
 * per field (the same convention HelpDesk-Coraje uses in `invalidForm`), so a
 * field never shows two competing messages.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

/**
 * Parses `value` or throws `InputValidationError`.
 *
 * Throwing (instead of returning a result union) fits the existing actions:
 * all of them already funnel failures through one `try/catch` that turns
 * `error.message` into the form state, and the void form actions are expected
 * to throw on bad input.
 */
export function parseInput<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InputValidationError(result.error);
  return result.data;
}

/** `fieldErrors` of a caught error when it came from schema validation, else undefined. */
export function fieldErrorsOf(error: unknown): FieldErrors | undefined {
  return error instanceof InputValidationError ? error.fieldErrors : undefined;
}

/**
 * Reads the given text fields of a FormData into a plain object for a schema.
 *
 * Files and absent keys become `undefined`, so `z.string()` reports them as
 * missing instead of zod receiving `null` or a `File` and producing a cryptic
 * type error.
 */
export function formFields<const Keys extends readonly string[]>(
  formData: FormData,
  keys: Keys,
): Record<Keys[number], string | undefined> {
  const values = {} as Record<Keys[number], string | undefined>;
  for (const key of keys as readonly Keys[number][]) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : undefined;
  }
  return values;
}

// ---------------------------------------------------------------------------
// Identifiers and text
// ---------------------------------------------------------------------------

/**
 * Primary keys are Prisma `cuid()` strings, but rows inserted by migrations or
 * imports may use other ids, so the schema checks a safe charset and length
 * rather than the cuid shape. That is enough to keep arbitrary payloads out of
 * queries and logs without rejecting legitimate legacy ids.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function entityId(label: string) {
  return z
    .string({ error: `Falta el campo obligatorio ${label}.` })
    .trim()
    .min(1, `Falta el campo obligatorio ${label}.`)
    .max(64, `El identificador ${label} no es válido.`)
    .regex(ID_PATTERN, `El identificador ${label} no es válido.`);
}

/** Required text: trimmed, non-empty, bounded. */
export function requiredText(options: { max: number; required: string; tooLong?: string }) {
  return z
    .string({ error: options.required })
    .trim()
    .min(1, options.required)
    .max(options.max, options.tooLong ?? `El texto no puede superar ${options.max} caracteres.`);
}

/**
 * Optional text with the semantics of the old `normalizeOptional`: absent,
 * non-string or blank all become `null`, otherwise the trimmed value.
 */
export function optionalText(options: { max: number; tooLong?: string }) {
  return z
    .string()
    .optional()
    .nullable()
    .transform((value) => value?.trim() || null)
    .refine((value) => value === null || value.length <= options.max, {
      error: options.tooLong ?? `El texto no puede superar ${options.max} caracteres.`,
    });
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Upper bound for an amount, in pesos.
 *
 * Amounts travel as JS numbers between the parser and `toFixed(2)`, and the
 * columns are `Decimal(18, 2)`. A number represents every cent exactly only
 * while `cents <= Number.MAX_SAFE_INTEGER`; past that, `toFixed(2)` starts
 * inventing cents. Capping here keeps every accepted amount exactly
 * representable end to end (and far inside Decimal(18, 2)).
 */
export const MAX_MONEY_PESOS = Math.floor(Number.MAX_SAFE_INTEGER / 100);

/**
 * Colombian money parsing, identical to `parseNumericInput` in
 * `@/lib/formatters` and to the old abono parser: `$`, spaces and every `.`
 * (thousands separator) are removed, then the first `,` becomes the decimal
 * point. Kept as a private copy so this module has no app imports; the schema
 * tests pin both to the same outputs.
 */
export function parseColombianNumber(value: string): number {
  const cleaned = value.trim().replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** True when `value` has at most two decimals, checked on the cleaned text, not the float. */
function hasAtMostTwoDecimals(raw: string): boolean {
  const cleaned = raw.trim().replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "");
  const decimals = cleaned.split(",")[1];
  return decimals === undefined || decimals.length <= 2;
}

/**
 * A strictly positive money amount typed by a person (`"100.000"`,
 * `"$ 1.250.000,50"`), parsed to the same number the old code produced.
 *
 * The output stays a `number` on purpose: the financial services compute with
 * numbers and serialize with `toFixed(2)`; changing that representation is a
 * business-rule change outside this module's remit. What the schema adds is the
 * guarantee that the number is finite, positive, has no sub-cent part and is
 * small enough for `toFixed(2)` to be exact (see `MAX_MONEY_PESOS`).
 */
export function moneyInput(messages: { required: string; invalid: string }) {
  return z
    .string({ error: messages.required })
    .trim()
    .min(1, messages.required)
    .max(32, messages.invalid)
    .refine(hasAtMostTwoDecimals, { error: "El valor admite máximo dos decimales." })
    .transform(parseColombianNumber)
    .refine((value) => Number.isFinite(value) && value > 0, { error: messages.invalid })
    .refine((value) => value <= MAX_MONEY_PESOS, { error: "El valor supera el máximo permitido." });
}

// ---------------------------------------------------------------------------
// Dates (America/Bogota)
// ---------------------------------------------------------------------------

/**
 * Today in America/Bogota as a local-midnight Date. Same algorithm as
 * `obtenerHoyColombia` in `@/lib/formatters`, which every action uses for
 * "not in the future" checks; duplicated here only to keep this module free of
 * app imports.
 */
export function todayInBogota(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"));
}

/**
 * A calendar date typed in an `<input type="date">` (`YYYY-MM-DD`).
 *
 * The output is local midnight, built with `new Date(y, m, d)` exactly like
 * `parseDateInputValue` and the old abono/payment parsers, so stored values do
 * not move. Unlike `parseDateInputValue`, impossible dates (`2026-02-30`) are
 * rejected instead of silently rolling into the next month.
 */
export function dateInput(label: string) {
  return z
    .string({ error: `Falta ${label}.` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${capitalize(label)} no tiene un formato válido (AAAA-MM-DD).`)
    .transform((value, context) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        context.addIssue({ code: "custom", message: `${capitalize(label)} no es una fecha válida en el calendario.` });
        return z.NEVER;
      }
      return date;
    });
}

/** `dateInput` that also refuses days after today in America/Bogota. */
export function pastOrTodayDateInput(label: string, futureMessage: string) {
  return dateInput(label).refine((date) => date.getTime() <= todayInBogota().getTime(), { error: futureMessage });
}

// ---------------------------------------------------------------------------
// Optimistic lock version and idempotency
// ---------------------------------------------------------------------------

const VERSION_MESSAGE = "Falta la versión del registro. Recarga la página e inténtalo de nuevo.";

/**
 * The row version a form read (`actualizadoEn.toISOString()`), echoed back so
 * the service can refuse to overwrite a newer row. See
 * `@/server/optimistic-lock`.
 */
export const rowVersion = z
  .string({ error: VERSION_MESSAGE })
  .trim()
  .min(1, VERSION_MESSAGE)
  .max(40, "La versión del registro no es válida. Recarga la página.")
  .transform((value, context) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "La versión del registro no es válida. Recarga la página." });
      return z.NEVER;
    }
    return date;
  });

const OPERATION_KEY_MESSAGE = "No se pudo identificar la operación. Recarga la página e inténtalo de nuevo.";

/**
 * Client-generated key identifying one logical submission (a UUID from
 * `crypto.randomUUID()`), reused verbatim on double clicks and retries so the
 * server can recognise a replay. Restricted to the UUID alphabet because it is
 * embedded in a unique business code.
 */
export const operationKey = z
  .string({ error: OPERATION_KEY_MESSAGE })
  .trim()
  .regex(/^[A-Za-z0-9-]{8,64}$/, OPERATION_KEY_MESSAGE);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
