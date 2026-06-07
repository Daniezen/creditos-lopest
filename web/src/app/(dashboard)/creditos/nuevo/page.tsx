import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function NuevoCreditoPage() {
  return (
    <ModulePlaceholder
      eyebrow="Creación formal"
      title="Nuevo crédito"
      description="Flujo transaccional para crear un crédito real. Este módulo reutilizará el motor del simulador, pero añadirá cliente, confirmación y persistencia segura en PostgreSQL."
      currentScope={[
        "Paso 1: seleccionar cliente existente o crear cliente mínimo.",
        "Paso 2: ingresar condiciones financieras del crédito.",
        "Paso 3: generar vista previa del cronograma usando el mismo motor del simulador.",
        "Paso 4: confirmar y guardar crédito + eventos financieros en una transacción Prisma.",
        "Este flujo será distinto del simulador libre: aquí sí habrá cliente, trazabilidad y persistencia.",
      ]}
      nextSteps={[
        "Diseñar wizard de creación: Cliente → Condiciones → Vista previa → Confirmar.",
        "Crear selector/buscador de cliente.",
        "Reutilizar componentes de resumen y cronograma del simulador.",
        "Implementar generación transaccional del código LP-YY-0001.",
        "Crear server action o endpoint para guardar crédito y eventos financieros.",
      ]}
      primaryAction={{
        label: "Usar simulador libre",
        href: "/simulador",
      }}
      secondaryAction={{
        label: "Volver a créditos",
        href: "/creditos",
      }}
    />
  );
}