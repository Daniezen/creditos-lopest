import { AlertTriangle, Clock, Coins, ShieldAlert, TrendingUp, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { HistoricoChart } from "@/features/analytics/components/HistoricoChart";
import { ProyeccionChart } from "@/features/analytics/components/ProyeccionChart";
import { 
  getHistoricoRecaudacion, 
  getProyeccionCartera,
  getResumenCartera,
  getResumenRiesgo,
  getCreditosMayorMonto,
  getCreditosMayorAtraso,
} from "@/features/analytics/queries";
import { formatCurrencyCOP } from "@/lib/formatters";
import { requireUser } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ReportesPage({ searchParams }: Props) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const tab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "resumen";

  if (!["resumen", "graficas", "riesgo"].includes(tab)) {
    redirect("/reportes?tab=resumen");
  }

  const [historico, proyeccion, resumen, resumenRiesgo, mayorMonto, mayorAtraso] = await Promise.all([
    getHistoricoRecaudacion(user),
    getProyeccionCartera(user),
    getResumenCartera(user),
    getResumenRiesgo(user),
    getCreditosMayorMonto(user, 8),
    getCreditosMayorAtraso(user, 8),
  ]);

  const tabs = [
    { id: "resumen", label: "Resumen de Cartera" },
    { id: "graficas", label: "Evolución y Proyección" },
    { id: "riesgo", label: "Control de Riesgo" },
  ];

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="text-2xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
          Panel de Analítica
        </h1>
        <p className="text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)] mt-1">
          Indicadores financieros, proyecciones de flujo y control de mora.
        </p>
      </div>

      <div className="mb-8 border-b border-[var(--color-border-subtle)]">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/reportes?tab=${t.id}`}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-[var(--font-weight-action)] transition ${
                tab === t.id
                  ? "border-[var(--color-focus)] text-[var(--color-selection-strong)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tab === "resumen" && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className={dataDisplayRecipes.metricCompact}>
              <p className={dataDisplayRecipes.metricCompactLabel}>
                <WalletCards className="h-3.5 w-3.5 text-[var(--color-action-primary)] shrink-0" />
                <span>Capital Activo</span>
              </p>
              <p className={dataDisplayRecipes.metricCompactValue}>
                {formatCurrencyCOP(resumen.capitalActivo)}
              </p>
              <p className={dataDisplayRecipes.metricCompactHelper}>
                En colocación vigente
              </p>
            </div>

            <div className={dataDisplayRecipes.metricCompact}>
              <p className={dataDisplayRecipes.metricCompactLabel}>
                <Coins className="h-3.5 w-3.5 text-[var(--color-action-primary)] shrink-0" />
                <span>Interés Proyectado</span>
              </p>
              <p className={dataDisplayRecipes.metricCompactValue}>
                {formatCurrencyCOP(resumen.interesProyectado)}
              </p>
              <p className={dataDisplayRecipes.metricCompactHelper}>
                Rendimiento esperado
              </p>
            </div>

            <div className={dataDisplayRecipes.metricCompact}>
              <p className={dataDisplayRecipes.metricCompactLabel}>
                <TrendingUp className="h-3.5 w-3.5 text-[var(--color-success)] shrink-0" />
                <span>Recaudo este Mes</span>
              </p>
              <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-success)]`}>
                {formatCurrencyCOP(resumen.recaudadoEsteMes)}
              </p>
              <p className={dataDisplayRecipes.metricCompactHelper}>
                Capital e interés cobrado
              </p>
            </div>

            <div className={dataDisplayRecipes.metricCompact}>
              <p className={dataDisplayRecipes.metricCompactLabel}>
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)] shrink-0" />
                <span>Capital en Riesgo</span>
              </p>
              <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-danger)]`}>
                {formatCurrencyCOP(resumen.capitalEnMora)}
              </p>
              <p className={dataDisplayRecipes.metricCompactHelper}>
                Cartera atrasada o en mora
              </p>
            </div>
          </div>
        )}

        {tab === "graficas" && (
          <div className="grid grid-cols-1 gap-8">
            <section className={`${surfaceRecipes.sectionSpacious} p-6 lg:p-10`}>
              <HistoricoChart data={historico} />
            </section>
            <section className={`${surfaceRecipes.sectionSpacious} p-6 lg:p-10`}>
              <ProyeccionChart data={proyeccion} />
            </section>
          </div>
        )}

        {tab === "riesgo" && (
          <div className="space-y-8">
            {/* Macro Categorías de Riesgo (Tramos de Mora) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className={dataDisplayRecipes.metricCompact}>
                <p className={dataDisplayRecipes.metricCompactLabel}>
                  <Clock className="h-3.5 w-3.5 text-[var(--color-warning)] shrink-0" />
                  <span>1 a 30 días</span>
                </p>
                <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-warning)]`}>
                  {formatCurrencyCOP(resumenRiesgo.mora1a30Monto)}
                </p>
                <p className={dataDisplayRecipes.metricCompactHelper}>
                  {resumenRiesgo.mora1a30Count} crédito(s) · Mora temprana
                </p>
              </div>

              <div className={dataDisplayRecipes.metricCompact}>
                <p className={dataDisplayRecipes.metricCompactLabel}>
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)] shrink-0" />
                  <span>31 a 60 días</span>
                </p>
                <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-warning)]`}>
                  {formatCurrencyCOP(resumenRiesgo.mora31a60Monto)}
                </p>
                <p className={dataDisplayRecipes.metricCompactHelper}>
                  {resumenRiesgo.mora31a60Count} crédito(s) · Mora moderada
                </p>
              </div>

              <div className={dataDisplayRecipes.metricCompact}>
                <p className={dataDisplayRecipes.metricCompactLabel}>
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)] shrink-0" />
                  <span>61 a 90 días</span>
                </p>
                <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-danger)]`}>
                  {formatCurrencyCOP(resumenRiesgo.mora61a90Monto)}
                </p>
                <p className={dataDisplayRecipes.metricCompactHelper}>
                  {resumenRiesgo.mora61a90Count} crédito(s) · Mora avanzada
                </p>
              </div>

              <div className={dataDisplayRecipes.metricCompact}>
                <p className={dataDisplayRecipes.metricCompactLabel}>
                  <ShieldAlert className="h-3.5 w-3.5 text-[var(--color-danger)] shrink-0" />
                  <span>Más de 90 días</span>
                </p>
                <p className={`${dataDisplayRecipes.metricCompactValue} text-[var(--color-danger)]`}>
                  {formatCurrencyCOP(resumenRiesgo.moraMas90Monto)}
                </p>
                <p className={dataDisplayRecipes.metricCompactHelper}>
                  {resumenRiesgo.moraMas90Count} crédito(s) · Mora crítica
                </p>
              </div>
            </div>

            {/* Dos Paneles: Mayor Monto Vencido vs Mayor Tiempo de Atraso */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Panel 1: Mayor Monto Vencido */}
              <div className={surfaceRecipes.dataPanel}>
                <div className={surfaceRecipes.dataPanelHeader}>
                  <div>
                    <h3 className="text-base font-[var(--font-weight-heading)] leading-6 text-[var(--color-text-primary)]">
                      Mayor Monto Vencido
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Créditos con mayor capital e interés adeudado.
                    </p>
                  </div>
                </div>
                {mayorMonto.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--color-text-secondary)]">
                    No hay cartera en mora actualmente.
                  </div>
                ) : (
                  <ul role="list" className="divide-y divide-[var(--color-border-subtle)]">
                    {mayorMonto.map((credito) => (
                      <li key={credito.id} className="flex items-center justify-between gap-x-4 px-5 py-4 transition hover:bg-[var(--color-selection)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-x-2.5">
                            <p className="truncate text-sm font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                              {credito.clienteNombre}
                            </p>
                            <span className={statusRecipes.danger}>
                              {credito.codigo}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-x-2 text-xs text-[var(--color-text-secondary)]">
                            <span className="font-medium text-[var(--color-text-primary)]">{credito.cuotasVencidas} cuota(s)</span>
                            <span>·</span>
                            <span>{credito.diasAtraso} días de atraso</span>
                          </div>
                        </div>
                        <div className="flex flex-none items-center gap-x-3">
                          <div className="text-right">
                            <p className="text-sm font-[var(--font-weight-heading)] text-[var(--color-danger)]">
                              {formatCurrencyCOP(credito.montoMora)}
                            </p>
                            <p className="text-xs text-[var(--color-text-secondary)]">Vencido</p>
                          </div>
                          <Link
                            href={`/creditos/${credito.id}`}
                            className={`${actionRecipes.secondary} hidden sm:inline-flex`}
                          >
                            Ver crédito<span className="sr-only">, {credito.clienteNombre}</span>
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Panel 2: Mayor Cantidad de Días de Atraso */}
              <div className={surfaceRecipes.dataPanel}>
                <div className={surfaceRecipes.dataPanelHeader}>
                  <div>
                    <h3 className="text-base font-[var(--font-weight-heading)] leading-6 text-[var(--color-text-primary)]">
                      Mayor Tiempo de Atraso
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Créditos con mayor antigüedad sin registrar abonos.
                    </p>
                  </div>
                </div>
                {mayorAtraso.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--color-text-secondary)]">
                    No hay cartera en mora actualmente.
                  </div>
                ) : (
                  <ul role="list" className="divide-y divide-[var(--color-border-subtle)]">
                    {mayorAtraso.map((credito) => (
                      <li key={credito.id} className="flex items-center justify-between gap-x-4 px-5 py-4 transition hover:bg-[var(--color-selection)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-x-2.5">
                            <p className="truncate text-sm font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                              {credito.clienteNombre}
                            </p>
                            <span className={statusRecipes.danger}>
                              {credito.codigo}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-x-2 text-xs text-[var(--color-text-secondary)]">
                            <span className={`font-semibold ${credito.diasAtraso > 90 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}`}>
                              {credito.diasAtraso} días acumulados
                            </span>
                            <span>·</span>
                            <span>{credito.cuotasVencidas} cuota(s)</span>
                          </div>
                        </div>
                        <div className="flex flex-none items-center gap-x-3">
                          <div className="text-right">
                            <p className="text-sm font-[var(--font-weight-heading)] text-[var(--color-danger)]">
                              {formatCurrencyCOP(credito.montoMora)}
                            </p>
                            <p className="text-xs text-[var(--color-text-secondary)]">Vencido</p>
                          </div>
                          <Link
                            href={`/creditos/${credito.id}`}
                            className={`${actionRecipes.secondary} hidden sm:inline-flex`}
                          >
                            Ver crédito<span className="sr-only">, {credito.clienteNombre}</span>
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
