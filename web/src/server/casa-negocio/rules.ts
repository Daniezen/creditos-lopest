/**
 * Business rules of a manual movement that need the referenced rows (account
 * group, archived flag, opening date; category class). Pure functions over
 * plain snapshots, so they are unit-tested without a database; the services
 * load the rows inside their transaction and call `validarMovimiento`.
 *
 * Shape per kind (the migration's CHECK "cn_movimientos_forma_por_tipo"
 * enforces the same NULL/NOT NULL pattern; group membership lives here
 * because a CHECK cannot look at another table):
 *
 *   kind            origin            destination       category
 *   GASTO_NEGOCIO   NEGOCIO           -                 -
 *   APORTE          CASA or none      NEGOCIO           -
 *   RETIRO_CASA     NEGOCIO           CASA              -     (cross-group transfer)
 *   TRASLADO        X                 X (same group)    -     ("pasar al ahorro" is one)
 *   GASTO_FIJO      CASA              -                 FIJO
 *   GASTO_VARIABLE  CASA              -                 VARIABLE
 *   INGRESO_CASA    -                 CASA              -
 */
import { CasaNegocioReglaError } from "./errors";

export type GrupoCuenta = "NEGOCIO" | "CASA";
export type TipoMovimiento =
  | "GASTO_NEGOCIO"
  | "APORTE"
  | "RETIRO_CASA"
  | "TRASLADO"
  | "GASTO_FIJO"
  | "GASTO_VARIABLE"
  | "INGRESO_CASA";

export interface CuentaRegla {
  id: string;
  nombre: string;
  grupo: GrupoCuenta;
  archivada: boolean;
  fechaSaldoInicial: Date;
}

export interface CategoriaRegla {
  id: string;
  nombre: string;
  clase: "FIJO" | "VARIABLE";
  activa: boolean;
}

export interface MovimientoRegla {
  tipo: TipoMovimiento;
  fecha: Date;
  origen: CuentaRegla | null;
  destino: CuentaRegla | null;
  categoria: CategoriaRegla | null;
}

interface Forma {
  origen: GrupoCuenta | "opcional-casa" | "cualquiera" | null;
  destino: GrupoCuenta | "mismo-grupo" | null;
  categoria: boolean;
}

const FORMAS: Record<TipoMovimiento, Forma> = {
  GASTO_NEGOCIO: { origen: "NEGOCIO", destino: null, categoria: false },
  APORTE: { origen: "opcional-casa", destino: "NEGOCIO", categoria: false },
  RETIRO_CASA: { origen: "NEGOCIO", destino: "CASA", categoria: false },
  TRASLADO: { origen: "cualquiera", destino: "mismo-grupo", categoria: false },
  GASTO_FIJO: { origen: "CASA", destino: null, categoria: true },
  GASTO_VARIABLE: { origen: "CASA", destino: null, categoria: true },
  INGRESO_CASA: { origen: null, destino: "CASA", categoria: false },
};

const NOMBRE_GRUPO: Record<GrupoCuenta, string> = { NEGOCIO: "del negocio", CASA: "de la casa" };

function fail(message: string, field?: string): never {
  throw new CasaNegocioReglaError(message, field);
}

function assertUsable(cuenta: CuentaRegla, fecha: Date, field: string): void {
  if (cuenta.archivada) fail(`La cuenta ${cuenta.nombre} está archivada.`, field);
  // The opening balance already contains everything before its date; a
  // movement dated earlier would be counted twice in the arqueo.
  if (fecha.getTime() < cuenta.fechaSaldoInicial.getTime()) {
    fail(`La cuenta ${cuenta.nombre} arranca después de esa fecha; su saldo inicial ya incluye lo anterior.`, "fecha");
  }
}

/**
 * Validates a movement against its accounts and category and returns the kind
 * to store. Household expenses are normalised to their category's class, so a
 * form that sends GASTO_FIJO for a category that was moved to variables files
 * the movement where the category now lives instead of failing.
 */
export function validarMovimiento(mov: MovimientoRegla): TipoMovimiento {
  let tipo = mov.tipo;
  if ((tipo === "GASTO_FIJO" || tipo === "GASTO_VARIABLE") && mov.categoria) {
    tipo = mov.categoria.clase === "FIJO" ? "GASTO_FIJO" : "GASTO_VARIABLE";
  }
  const forma = FORMAS[tipo];

  // Origin
  if (forma.origen === null) {
    if (mov.origen) fail("Este movimiento no sale de ninguna cuenta.", "cuentaOrigenId");
  } else if (forma.origen === "opcional-casa") {
    if (mov.origen && mov.origen.grupo !== "CASA") {
      fail("Un aporte solo puede venir de una cuenta de la casa.", "cuentaOrigenId");
    }
  } else {
    if (!mov.origen) fail("Indica de qué cuenta sale la plata.", "cuentaOrigenId");
    if (forma.origen !== "cualquiera" && mov.origen.grupo !== forma.origen) {
      fail(`La plata debe salir de una cuenta ${NOMBRE_GRUPO[forma.origen]}.`, "cuentaOrigenId");
    }
  }

  // Destination
  if (forma.destino === null) {
    if (mov.destino) fail("Este movimiento no entra a ninguna cuenta.", "cuentaDestinoId");
  } else {
    if (!mov.destino) fail("Indica a qué cuenta entra la plata.", "cuentaDestinoId");
    if (forma.destino === "mismo-grupo") {
      if (mov.origen && mov.origen.grupo !== mov.destino.grupo) {
        fail("Un traslado es entre cuentas del mismo grupo; para llevar plata a la casa usa «Retiro a la casa».", "cuentaDestinoId");
      }
    } else if (mov.destino.grupo !== forma.destino) {
      fail(`La plata debe entrar a una cuenta ${NOMBRE_GRUPO[forma.destino]}.`, "cuentaDestinoId");
    }
  }

  if (mov.origen && mov.destino && mov.origen.id === mov.destino.id) {
    fail("La cuenta de origen y la de destino son la misma.", "cuentaDestinoId");
  }

  // Category
  if (forma.categoria) {
    if (!mov.categoria) fail("Indica en qué gasto de la casa va.", "categoriaId");
    if (!mov.categoria.activa) fail(`El gasto ${mov.categoria.nombre} está inactivo.`, "categoriaId");
  } else if (mov.categoria) {
    fail("Solo los gastos de la casa llevan categoría.", "categoriaId");
  }

  if (mov.origen) assertUsable(mov.origen, mov.fecha, "cuentaOrigenId");
  if (mov.destino) assertUsable(mov.destino, mov.fecha, "cuentaDestinoId");

  return tipo;
}
