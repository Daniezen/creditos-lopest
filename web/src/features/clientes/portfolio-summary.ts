import type {
  EstadoCredito,
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
} from "@prisma/client";

export type EstadoCarteraCliente =
  | "SIN_CREDITOS_ACTIVOS"
  | "AL_DIA"
  | "ATRASADO"
  | "MORA";

interface EventoResumenCartera {
  tipo: TipoEventoFinanciero;
  estado: EstadoEventoFinanciero;
  interesProgramado: unknown;
}

interface CreditoResumenCartera {
  estado: EstadoCredito;
  eventos: EventoResumenCartera[];
}

export interface ResumenCarteraCliente {
  interesPendienteTotal: number;
  estadoCartera: EstadoCarteraCliente;
}

/**
 * Derives the client portfolio summary from the financial event ledger.
 *
 * Pending interest is contractual interest from unpaid scheduled installments
 * of active credits. Paid installments, installments cancelled by a principal
 * prepayment, principal-prepayment events and cancelled credits do not belong
 * to the outstanding schedule.
 */
export function calcularResumenCarteraCliente(
  creditos: CreditoResumenCartera[],
): ResumenCarteraCliente {
  const creditosActivos = creditos.filter((credito) => credito.estado === "ACTIVO");

  if (creditosActivos.length === 0) {
    return {
      interesPendienteTotal: 0,
      estadoCartera: "SIN_CREDITOS_ACTIVOS",
    };
  }

  const cuotasOperativas = creditosActivos.flatMap((credito) =>
    credito.eventos.filter(
      (evento) =>
        evento.tipo === "CUOTA_PROGRAMADA" &&
        isEstadoCuotaOperativa(evento.estado),
    ),
  );

  const interesPendienteTotal = cuotasOperativas.reduce((total, evento) => {
    const interes = Number(evento.interesProgramado);
    return total + (Number.isFinite(interes) && interes > 0 ? interes : 0);
  }, 0);

  const estadoCartera = cuotasOperativas.some((evento) => evento.estado === "MORA")
    ? "MORA"
    : cuotasOperativas.some((evento) => evento.estado === "ATRASADO")
      ? "ATRASADO"
      : "AL_DIA";

  return {
    interesPendienteTotal,
    estadoCartera,
  };
}

function isEstadoCuotaOperativa(estado: EstadoEventoFinanciero): boolean {
  return estado === "PENDIENTE" || estado === "ATRASADO" || estado === "MORA";
}
