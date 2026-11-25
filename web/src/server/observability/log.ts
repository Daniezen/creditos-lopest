/**
 * Structured server logger for Lopest.
 *
 * Every call writes **one JSON line** to the container's stdout/stderr, which
 * is exactly what `docker compose logs web` already keeps. There is no agent,
 * file or extra service to maintain.
 *
 * Why one JSON line instead of `console.error("Error al crear…", error)`:
 * - Lines are filtered by field (`evento`, `creditoId`) instead of free text,
 *   e.g. `docker compose logs web | grep '"creditoId":"ck…"'`.
 * - Correlation identifiers always use the same name, and that name is the
 *   Prisma foreign-key name (`creditoId`, `clienteId`, `abonoEventoId`,
 *   `userId`), so a value seen in a log line can be pasted straight into a
 *   `where` clause or a SQL query without translation.
 * - What must not leave the process does not leave it: fields whose name looks
 *   like a secret or like client personal data are replaced by `[omitido]`,
 *   and recognisable tokens are scrubbed from free text and error stacks.
 *
 * This is the only file in `src/` allowed to call `console.*`; the test
 * `__tests__/log.test.ts` enforces it.
 *
 * Adapted from HelpDesk Coraje (`src/server/observability/log.ts`).
 */

export type LogLevel = "info" | "warn" | "error";

/** Flat values only: a nested object is where an unnamed secret sneaks in. */
export type LogValue = string | number | boolean | null | undefined;

/**
 * Fields of a log line. Correlation fields have fixed names (mirroring the
 * Prisma schema) so two modules never call the same thing differently.
 */
export interface LogFields {
  /** `Credito.id` (FK name `creditoId` across the schema). */
  creditoId?: string;
  /** `Cliente.id` (FK name `clienteId`). */
  clienteId?: string;
  /** `EventoFinanciero.id` of an ABONO_CAPITAL (FK name in `AbonoSnapshot`). */
  abonoEventoId?: string;
  /** `User.id` of the acting user (FK name `userId` in `UserRole`/`OauthAccount`). */
  userId?: string;
  [campo: string]: LogValue;
}

const OMITTED = "[omitido]";
const MAX_TEXT = 500;
const MAX_STACK = 2000;

/**
 * Field names that are never written, whatever their value. Matching is
 * case-insensitive and by substring, so `refreshToken`, `x-cron-secret`,
 * `carpetaUrl` or `emailCliente` are all caught.
 *
 * Besides secrets, this covers client personal data (cédula, phone, e-mail,
 * names, addresses) and document links: logs are read by operators and can be
 * copied around, so they must never become a second copy of the client base.
 */
const SECRET_FIELD =
  /token|secret|secreto|password|contrase|clave|cookie|authorization|otp|cuerpo|body|html|enlace|link|url|cedula|email|correo|telefono|celular|direccion|nombre/i;

/**
 * Secret shapes recognisable inside free text: a Bearer header, a JWT (three
 * base64url segments starting with `eyJ`), query parameters with secret-like
 * names (`?code=…`, `&sig=…`) and the password part of a connection URL
 * (`postgresql://user:password@host`).
 */
const SECRET_IN_TEXT: readonly RegExp[] = [
  /Bearer\s+[\w.~+/-]+=*/gi,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g,
  /([?&](?:code|token|access_token|refresh_token|id_token|sig|secret|key)=)[^&\s"']+/gi,
  /(\w+:\/\/[^:/\s@]+:)[^@\s]+(?=@)/g,
];

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Removes anything that looks like a secret from a text. When a pattern has a
 * capturing prefix (the query parameter name, the URL user), the prefix is
 * kept so the line still says *what* was removed.
 */
export function scrubText(text: string): string {
  let out = text;
  for (const pattern of SECRET_IN_TEXT) {
    out = out.replace(pattern, (match, prefix?: string) =>
      typeof prefix === "string" && match.startsWith(prefix) ? `${prefix}${OMITTED}` : OMITTED,
    );
  }
  return out;
}

/** Serialises an error into flat, scrubbed, size-bounded fields. */
function describeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    const out: Record<string, string> = {
      nombre: error.name,
      mensaje: truncate(scrubText(error.message), MAX_TEXT),
    };
    // Prisma (`P2002`) and Node (`ECONNREFUSED`) errors carry a useful code.
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") out.codigo = String(code);
    if (error.stack) out.traza = truncate(scrubText(error.stack), MAX_STACK);
    return out;
  }
  return { mensaje: truncate(scrubText(String(error)), MAX_TEXT) };
}

/**
 * Builds the line exactly as it will be written. Kept separate from `logEvent`
 * so tests can assert the output without capturing the console.
 */
export function buildLogLine(
  level: LogLevel,
  evento: string,
  fields: LogFields = {},
  error?: unknown,
  now: Date = new Date(),
): string {
  const line: Record<string, unknown> = { ts: now.toISOString(), nivel: level, evento };
  for (const [campo, valor] of Object.entries(fields)) {
    // `campo in line` stops a field from overwriting ts/nivel/evento.
    if (valor === undefined || campo in line) continue;
    if (SECRET_FIELD.test(campo)) line[campo] = OMITTED;
    else line[campo] = typeof valor === "string" ? truncate(scrubText(valor), MAX_TEXT) : valor;
  }
  if (error !== undefined) line.error = describeError(error);
  return JSON.stringify(line);
}

/**
 * Logs a server event.
 *
 * `evento` is a stable `dominio.que_paso` name (`credito.creacion_fallida`,
 * `drive.compensacion_fallida`): it is what operators filter by, so it carries
 * no data. Data goes in `fields`; the error goes apart so its stack does not
 * mix with the fields.
 */
export function logEvent(level: LogLevel, evento: string, fields: LogFields = {}, error?: unknown): void {
  const line = buildLogLine(level, evento, fields, error);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
