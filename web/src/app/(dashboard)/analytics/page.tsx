import { BarChart3 } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Analítica"
      title="Analytics"
      description="Consulta indicadores y reportes de la cartera."
      icon={BarChart3}
      primaryAction={{
        label: "Ir al simulador",
        href: "/simulador",
      }}
      secondaryAction={{
        label: "Ver créditos",
        href: "/creditos",
      }}
    />
  );
}