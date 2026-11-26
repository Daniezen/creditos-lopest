/**
 * Alert 7 of spec §5 («un movimiento dejaría una cuenta sin saldo») judged
 * while the person types, with the domain engine's own rule: only rule 7 is
 * evaluated, so its wording and its boundary (emptying an account to exactly
 * 0 is allowed) are the engine's, not the form's.
 *
 * `devuelto` is what the movement being edited already took from that same
 * account: the balance shown in the form already includes it.
 */
import { REGLAS_AVISO, evaluarAvisos, type ConfigAvisos } from "@/features/casa-negocio/domain";

const SOLO_SIN_SALDO: ConfigAvisos = Object.fromEntries(
  REGLAS_AVISO.map((r) => [r.id, { activa: r.id === "CUENTA_SIN_SALDO", umbral: r.umbral }]),
);

const CASA_NEUTRA = { entro: 0, fijos: 0, variables: 0, hoy: 0, fijosSinPagar: 0, alCierre: 0, quedaEnSobres: 0, siSeGastanSobres: 0 };
const NEGOCIO_NEUTRO = { intereses: 0, gastos: 0, perdidos: 0, ganancia: 0, retirosCasa: 0, reinvertido: 0 };

export function avisoSinSaldo(
  cuenta: { id: string; nombre: string; saldoActual: number } | undefined,
  monto: number,
  devuelto = 0,
): string | null {
  if (!cuenta || !Number.isFinite(monto) || monto <= 0) return null;
  const [aviso] = evaluarAvisos(
    {
      mes: "2000-01",
      hoy: "2000-01-01",
      fijos: [],
      sobres: [],
      casa: CASA_NEUTRA,
      cuentas: [],
      negocio: NEGOCIO_NEUTRO,
      salidasPropuestas: [
        { cuentaId: cuenta.id, nombreCuenta: cuenta.nombre, saldoActual: Math.round(cuenta.saldoActual + devuelto), monto: Math.round(monto) },
      ],
      creditos: [],
      gastosFijos: [],
      pagosFijos: [],
      cierreAnterior: null,
    },
    SOLO_SIN_SALDO,
  );
  return aviso?.texto ?? null;
}
