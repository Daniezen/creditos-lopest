import { requireUser } from "@/server/auth/guards";
import { getHistoricoRecaudacion, getProyeccionCartera } from "@/features/analytics/queries";
import { HistoricoChart } from "@/features/analytics/components/HistoricoChart";
import { ProyeccionChart } from "@/features/analytics/components/ProyeccionChart";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const user = await requireUser();

  // Fetch in parallel for efficiency
  const [historico, proyeccion] = await Promise.all([
    getHistoricoRecaudacion(user),
    getProyeccionCartera(user),
  ]);

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Panel de Analítica
        </h1>
        <p className="text-sm text-slate-500">
          Métricas de recuperación y proyecciones de flujo de caja.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Histórico */}
        <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-10">
          <HistoricoChart data={historico} />
        </section>

        {/* Proyección */}
        <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-10">
          <ProyeccionChart data={proyeccion} />
        </section>
      </div>
    </main>
  );
}
