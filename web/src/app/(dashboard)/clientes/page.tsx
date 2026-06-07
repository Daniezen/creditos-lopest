import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function ClientesPage() {
  return (
    <ModulePlaceholder
      eyebrow="Gestión de clientes"
      title="Clientes"
      description="Módulo para administrar perfiles de clientes, información de contacto, documentos y relación con créditos."
      currentScope={[
        "Consultar clientes por nombre, cédula o teléfono.",
        "Ver créditos asociados a cada cliente.",
        "Mantener metadatos documentales sin guardar archivos binarios en PostgreSQL.",
        "Preparar integración con Google Drive para documentos existentes.",
      ]}
      nextSteps={[
        "Crear listado de clientes con búsqueda.",
        "Diseñar ficha de cliente.",
        "Implementar creación y edición de cliente.",
        "Conectar documentos de cliente con metadata en PostgreSQL y archivos en Drive.",
      ]}
      primaryAction={{
        label: "Crear crédito",
        href: "/creditos/nuevo",
      }}
      secondaryAction={{
        label: "Ir a créditos",
        href: "/creditos",
      }}
    />
  );
}