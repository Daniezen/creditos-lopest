/**
 * Errors raised by the Casa y Negocio services. Both carry a message written
 * for the person using the module, so the action layer can show `message`
 * as-is; anything else that escapes a service is unexpected and is logged.
 */

/** The user lacks the capability the operation needs. */
export class CasaNegocioPermisoError extends Error {
  constructor(message = "No tienes permiso para hacer esto en Casa y Negocio.") {
    super(message);
    this.name = "CasaNegocioPermisoError";
  }
}

/** A business rule refused the operation (wrong account group, archived account, ...). */
export class CasaNegocioReglaError extends Error {
  /** Form field the rule is about, when there is one. */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "CasaNegocioReglaError";
    this.field = field;
  }
}
