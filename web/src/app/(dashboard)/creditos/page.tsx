import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function CreditosPage() {
  return (
    <ModulePlaceholder
      eyebrow="Gestión de cartera"
      title="Créditos"
      description="Biblioteca operativa para consultar, filtrar y abrir créditos existentes. Esta vista será la entrada principal para seguimiento de cartera después del simulador."
      currentScope={[
        "Listar créditos con cliente, código, estado, monto, saldo y próxima cuota.",
        "Filtrar por estado, cliente, frecuencia, vencimiento y modalidad.",
        "Abrir el detalle de un crédito para pagos, abonos, documentos y trazabilidad.",
        "Separar consulta operativa de creación formal de nuevos créditos.",
      ]}
      nextSteps={[
        "Definir query base de créditos con resumen financiero.",
        "Crear vista de listado con filtros y paginación.",
        "Diseñar detalle de crédito con cronograma y estado real.",
        "Conectar pagos, abonos y documentos en fases posteriores.",
      ]}
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