import { cnCardRecipes, cnCasaRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { DiaCasa, FilaCasa } from "@/server/casa-negocio/vista-casa";

import { formatMoney } from "../shared/format";
import { EditarMovimiento, type OpcionesEdicion } from "./editar-movimiento";

const PUNTO: Record<FilaCasa["clase"], string> = {
  fijo: cnCasaRecipes.dotFijo,
  variable: cnCasaRecipes.dotVariable,
  ingreso: cnCasaRecipes.dotIngreso,
  retiro: cnCasaRecipes.dotIngreso,
  otro: cnCasaRecipes.dotOtro,
};

function Monto({ fila }: { fila: FilaCasa }) {
  if (fila.montoTraslado !== null) {
    return <span className={`${cnCasaRecipes.rowAmount} ${cnCasaRecipes.amountNeutral}`}>{formatMoney(fila.montoTraslado)}</span>;
  }
  const entra = fila.monto > 0;
  return (
    <span className={`${cnCasaRecipes.rowAmount} ${entra ? cnCasaRecipes.amountIn : cnCasaRecipes.amountOut}`}>
      {entra ? "+" : ""}
      {formatMoney(fila.monto)}
    </span>
  );
}

/**
 * Libro de la casa: one white card per day, the day as a big light number,
 * its movements inside. Business retiros show up on their own (they are
 * edited in Negocio). The same cards serve the phone.
 */
export function LibroCasa({
  libro,
  nombreMes,
  edicion,
}: {
  libro: DiaCasa[];
  nombreMes: string;
  /** Null in read-only mode: no edit buttons. */
  edicion: OpcionesEdicion | null;
}) {
  if (libro.length === 0) {
    return (
      <section aria-label="Libro de la casa" className={cnCasaRecipes.book}>
        <p className={cnCardRecipes.empty}>Nada anotado en {nombreMes}.</p>
      </section>
    );
  }
  return (
    <section aria-label="Libro de la casa" className={cnCasaRecipes.book}>
      {libro.map((d) => (
        <article key={d.fecha} aria-label={`${d.dia} de ${nombreMes}`} className={cnCasaRecipes.day}>
          <div className={cnCasaRecipes.dayHead} aria-hidden="true">
            <div className={cnCasaRecipes.dayNumber}>{d.dia}</div>
            <div className={cnCasaRecipes.dayWeek}>{d.semana}</div>
          </div>
          <ul className={cnCasaRecipes.dayRows}>
            {d.filas.map((f) => (
              <li key={f.id} className={cnCasaRecipes.row}>
                <span aria-hidden="true" className={PUNTO[f.clase]} />
                <div className={cnCasaRecipes.rowBody}>
                  <div className={cnCasaRecipes.rowName}>{f.nombre}</div>
                  <div className={cnCasaRecipes.rowSub}>{f.detalle}</div>
                </div>
                <Monto fila={f} />
                {edicion && f.editable ? <EditarMovimiento movimiento={f.editable} nombre={f.nombre} opciones={edicion} /> : null}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
