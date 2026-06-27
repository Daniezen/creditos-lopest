import { CreditCard } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function CreditosPage() {
  return (
    <ModulePlaceholder
      eyebrow="Gestión de cartera"
      title="Créditos"
      description="Consulta y administra los créditos registrados en la plataforma."
      icon={CreditCard}
      primaryAction={{
        label: "Crear nuevo crédito",
        href: "/creditos/nuevo",
      }}
      secondaryAction={{
        label: "Ir al simulador",
        href: "/simulador",
      }}
    />
  );
}