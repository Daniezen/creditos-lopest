import { requireUser } from "@/server/auth/guards";
import { 
  getHistoricoRecaudacion, 
  getProyeccionCartera,
  getResumenCartera,
  getCreditosEnRiesgo
} from "@/features/analytics/queries";
import { HistoricoChart } from "@/features/analytics/components/HistoricoChart";
import { ProyeccionChart } from "@/features/analytics/components/ProyeccionChart";
import { formatCurrencyCOP } from "@/lib/formatters";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  const [historico, proyeccion, resumen, enRiesgo] = await Promise.all([
    getHistoricoRecaudacion(user),
    getProyeccionCartera(user),
    getResumenCartera(user),
    getCreditosEnRiesgo(user),
  ]);

  const tabs = [
    { id: "resumen", label: "Resumen de Cartera" },
    { id: "graficas", label: "Evolución y Proyección" },
    { id: "riesgo", label: "Control de Riesgo" },
  ];

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Panel de Analítica
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Indicadores financieros, proyecciones de flujo y control de mora.
        </p>
      </div>

      <div className="mb-8 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/reportes?tab=${t.id}`}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                tab === t.id
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tab === "resumen" && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <dt className="truncate text-sm font-medium text-slate-500">Capital Activo (En Calle)</dt>
              <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{formatCurrencyCOP(resumen.capitalActivo)}</dd>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <dt className="truncate text-sm font-medium text-slate-500">Interés Proyectado</dt>
              <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{formatCurrencyCOP(resumen.interesProyectado)}</dd>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <dt className="truncate text-sm font-medium text-slate-500">Recaudo este Mes</dt>
              <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900 text-emerald-600">{formatCurrencyCOP(resumen.recaudadoEsteMes)}</dd>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <dt className="truncate text-sm font-medium text-slate-500">Capital en Riesgo (Mora/Atraso)</dt>
              <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-900 text-rose-600">{formatCurrencyCOP(resumen.capitalEnMora)}</dd>
            </div>
          </div>
        )}

        {tab === "graficas" && (
          <div className="grid grid-cols-1 gap-8">
            <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-10">
              <HistoricoChart data={historico} />
            </section>
            <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-10">
              <ProyeccionChart data={proyeccion} />
            </section>
          </div>
        )}

        {tab === "riesgo" && (
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <h3 className="text-base font-semibold leading-6 text-slate-900">Atención Inmediata</h3>
              <p className="mt-1 text-sm text-slate-500">Créditos con mayores montos vencidos o días de atraso.</p>
            </div>
            {enRiesgo.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No hay cartera en mora actualmente.
              </div>
            ) : (
              <ul role="list" className="divide-y divide-slate-200">
                {enRiesgo.map((credito) => (
                  <li key={credito.id} className="flex items-center justify-between gap-x-6 px-6 py-5 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="flex items-start gap-x-3">
                        <p className="text-sm font-semibold leading-6 text-slate-900">{credito.clienteNombre}</p>
                        <p className="rounded-md whitespace-nowrap mt-0.5 px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset text-rose-700 bg-rose-50 ring-rose-600/20">
                          {credito.codigo}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-x-2 text-xs leading-5 text-slate-500">
                        <p className="whitespace-nowrap">{credito.diasAtraso} días de atraso acumulado</p>
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-x-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold leading-6 text-rose-600">{formatCurrencyCOP(credito.montoMora)}</p>
                        <p className="text-xs leading-5 text-slate-500">Vencido</p>
                      </div>
                      <Link
                        href={`/creditos/${credito.id}`}
                        className="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:block"
                      >
                        Ver crédito<span className="sr-only">, {credito.clienteNombre}</span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
