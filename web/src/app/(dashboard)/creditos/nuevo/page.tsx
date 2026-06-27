import { obtenerClientesParaSelector } from "@/features/clientes/queries";
import { CreateCreditPageContent } from "@/features/creditos/crear/create-credit-page-content";

/**
 * Página dinámica.
 *
 * Esta vista consulta clientes desde PostgreSQL en runtime.
 *
 * Decisión:
 * - No debe prerenderizarse como HTML estático durante el build.
 * - Next.js puede cargar módulos server-side durante el build para recolectar
 *   configuración, pero la consulta real a base de datos debe ocurrir en runtime.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoCreditoPage() {
  const clientes = await obtenerClientesParaSelector();

  return <CreateCreditPageContent initialClientes={clientes} />;
}