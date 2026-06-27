import { Users } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function ClientesPage() {
  return (
    <ModulePlaceholder
      eyebrow="Clientes"
      title="Clientes"
      description="Consulta y administra la información de los clientes."
      icon={Users}
      primaryAction={{
        label: "Crear crédito",
        href: "/creditos/nuevo",
      }}
      secondaryAction={{
        label: "Ver créditos",
        href: "/creditos",
      }}
    />
  );
}