import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Analítica"
      title="Analytics"
      description="Espacio reservado para análisis de cartera y, más adelante, el panel de Data Studio/Looker Studio embebido."
      currentScope={[
        "Reservar ruta formal para analítica de cartera.",
        "Preparar embed futuro del reporte existente de Data Studio/Looker Studio.",
        "Evitar mezclar visualizaciones externas con lógica operativa del simulador o créditos.",
        "Mantener separación entre operación diaria y análisis gerencial.",
      ]}
      nextSteps={[
        "Definir URL de embed del reporte existente.",
        "Validar permisos de visualización del informe.",
        "Crear layout responsive para iframe analítico.",
        "Evaluar si conviene reemplazar partes del reporte con vistas SQL propias más adelante.",
      ]}
      primaryAction={{
        label: "Ir al simulador",
        href: "/simulador",
      }}
      secondaryAction={{
        label: "Ir a créditos",
        href: "/creditos",
      }}
    />
  );
}