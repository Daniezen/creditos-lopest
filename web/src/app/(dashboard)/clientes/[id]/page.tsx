import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Contact,
  CreditCard,
  Edit3,
  Eye,
  Home,
  Phone,
  UserRound,
  WalletCards,
} from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { deriveClientDetailPortfolio, type ClientDetailCreditItem } from "@/features/clientes/client-detail-portfolio";
import { ClientDocumentsPanel } from "@/features/clientes/documentos/components/client-documents-panel";
import { obtenerClienteDetalle } from "@/features/clientes/queries";
import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";
import { getCurrentUser, hasRole } from "@/server/auth/guards";

import styles from "./cliente-detalle.module.css";

interface ClienteDetallePageProps { params: Promise<{ id: string }>; }
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClienteDetallePage({ params }: ClienteDetallePageProps) {
  const { id } = await params;
  const [cliente, user] = await Promise.all([obtenerClienteDetalle(id), getCurrentUser()]);
  if (!cliente) notFound();

  const perfilIncompleto = !cliente.telefono || !cliente.direccion || cliente.estadoDocumentos === "FALTAN_DOCUMENTOS";
  const portfolio = deriveClientDetailPortfolio(cliente.creditos);

  return (
    <main className={styles.page}>
      <section className={`${surfaceRecipes.sectionSpacious} ${styles.identitySection}`}>
        <div className={styles.identityLayout}>
          <div className="min-w-0">
            <p className={styles.eyebrow}>Cliente</p>
            <h2 className={styles.clientName}>{cliente.nombre}</h2>
            <div className={styles.identityMeta}>
              <span>C.C. {cliente.cedula}</span>
              <span className={styles.inlineMeta}><Phone className={styles.smallIcon} />{cliente.telefono || "Sin teléfono"}</span>
              {cliente.empresa ? <span>{cliente.empresa}</span> : null}
            </div>
          </div>
          <div className={styles.actions}>
            <Link href="/clientes" className={actionRecipes.secondaryLarge}><ArrowLeft className="h-4 w-4" />Volver</Link>
            <Link href={`/clientes/${cliente.id}/editar`} className={actionRecipes.primaryLarge}><Edit3 className="h-4 w-4" />Editar</Link>
          </div>
        </div>
      </section>

      {perfilIncompleto ? <section className={styles.warning}><AlertTriangle className="h-5 w-5 shrink-0" /><div><h3>Perfil pendiente de completar</h3><p>Completa teléfono, dirección y estado documental cuando la información esté disponible.</p></div></section> : null}

      <section className={styles.metricsGrid}>
        <Metric icon={CreditCard} label="Créditos activos" value={String(portfolio.creditosActivos)} />
        <Metric icon={WalletCards} label="Capital pendiente" value={formatCurrencyCOP(portfolio.capitalPendiente)} />
        <Metric icon={CreditCard} label="Interés pendiente" value={formatCurrencyCOP(portfolio.interesPendiente)} />
        <Metric icon={AlertTriangle} label="Con cuotas vencidas" value={String(portfolio.creditosConCuotasVencidas)} warning={portfolio.creditosConCuotasVencidas > 0} />
      </section>

      <section className={`${surfaceRecipes.section} ${styles.infoSection}`}>
        <header className={styles.sectionHeader}><div><h3 className={dataDisplayRecipes.sectionTitle}>Información del cliente</h3><p>Contacto, referencia y documentación.</p></div><DocumentStatus status={cliente.estadoDocumentos} /></header>
        <div className={styles.infoGrid}>
          <Info icon={Phone} label="Teléfono" value={cliente.telefono || "-"} />
          <Info icon={Home} label="Dirección" value={cliente.direccion || "-"} />
          <Info icon={Building2} label="Empresa" value={cliente.empresa || "-"} />
          <Info icon={Contact} label="Contacto" value={cliente.contacto || "-"} />
          <Info icon={Contact} label="Contacto 2" value={cliente.contacto2 || "-"} />
          <Info icon={UserRound} label="Recomienda" value={cliente.recomienda || "-"} />
        </div>
        <ClientDocumentsPanel clienteId={cliente.id} clienteNombre={cliente.nombre} clienteCedula={cliente.cedula} carpetaUrl={cliente.carpetaAdjuntosUrl} documentos={cliente.documentos} canUpload={Boolean(user && (hasRole(user, "ADMIN") || hasRole(user, "OPERADOR")))} maxFiles={Number(process.env.DOCUMENT_UPLOAD_MAX_FILES || 10)} maxBytes={Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 10485760)} />
      </section>

      <section className={surfaceRecipes.dataPanel}>
        <header className={surfaceRecipes.dataPanelHeader}><div><h3 className={dataDisplayRecipes.sectionTitle}>Créditos</h3><p className={styles.supporting}>{portfolio.items.length} registro(s)</p></div></header>
        {portfolio.items.length === 0 ? <div className={styles.empty}>Este cliente aún no tiene créditos registrados.</div> : <CreditPortfolio items={portfolio.items} />}
      </section>
    </main>
  );
}

function CreditPortfolio({ items }: { items: ClientDetailCreditItem[] }) {
  return <>
    <div className={styles.compactCredits}>{items.map((credit) => <CreditCompact key={credit.id} credit={credit} />)}</div>
    <div className={styles.desktopTable}><table className={styles.creditTable}><thead><tr><TableHead>Código</TableHead><TableHead className="text-right">Monto original</TableHead><TableHead className="text-right">Capital pendiente</TableHead><TableHead className="text-right">Interés pendiente</TableHead><TableHead>Próxima cuota</TableHead><TableHead>Estado</TableHead></tr></thead><tbody>{items.map((credit) => <tr key={credit.id} className={dataDisplayRecipes.operationalRow}><TableCell><div className={styles.identityCell}><Link href={`/creditos/${credit.id}`} className={dataDisplayRecipes.entityLink}>{credit.codigo}</Link><Link href={`/creditos/${credit.id}`} className={actionRecipes.entityDetailIcon} aria-label={`Ver detalle de ${credit.codigo}`}><Eye className="h-4 w-4" /></Link></div></TableCell><Money value={credit.monto} /><Money value={credit.saldoCapital} /><Money value={credit.interesPendiente} /><TableCell><Installment credit={credit} /></TableCell><TableCell><CreditStatus credit={credit} /></TableCell></tr>)}</tbody></table></div>
  </>;
}

function CreditCompact({ credit }: { credit: ClientDetailCreditItem }) {
  return <article className={styles.compactCredit}><div className={styles.compactHeader}><div><Link href={`/creditos/${credit.id}`} className={dataDisplayRecipes.compactEntityLink}>{credit.codigo}</Link><p className={styles.supporting}>{formatDateCO(credit.fechaPrestamo)}</p></div><CreditStatus credit={credit} /></div><dl className={styles.flatGrid}><Datum label="Monto original" value={formatCurrencyCOP(credit.monto)} /><Datum label="Capital pendiente" value={formatCurrencyCOP(credit.saldoCapital)} /><Datum label="Interés pendiente" value={formatCurrencyCOP(credit.interesPendiente)} /><div><dt className={dataDisplayRecipes.flatDatumLabel}>Próxima cuota</dt><dd><Installment credit={credit} /></dd></div></dl><Link href={`/creditos/${credit.id}`} className={`${actionRecipes.tertiaryPill} ${styles.compactLink}`}><Eye className="h-4 w-4" />Ver crédito</Link></article>;
}

function Installment({ credit }: { credit: ClientDetailCreditItem }) {
  if (credit.cuotaVencidaMasAntigua) return <div><p className={styles.overdueText}>Vencida {formatDateCO(credit.cuotaVencidaMasAntigua.fechaProgramada)}</p><p className={styles.supporting}>{formatCurrencyCOP(credit.cuotaVencidaMasAntigua.valorProgramado)}</p></div>;
  if (credit.proximaCuota) return <div><p className={dataDisplayRecipes.numericCell}>{formatCurrencyCOP(credit.proximaCuota.valorProgramado)}</p><p className={styles.supporting}>{formatDateCO(credit.proximaCuota.fechaProgramada)}</p></div>;
  return <>-</>;
}
function CreditStatus({ credit }: { credit: ClientDetailCreditItem }) { if (credit.estado === "CANCELADO") return <span className={statusRecipes.neutral}>Cancelado</span>; if (credit.tieneCuotasVencidas) return <span className={statusRecipes.warning}>Con cuotas vencidas</span>; return <span className={statusRecipes.success}>Activo</span>; }
function Metric({ icon: Icon, label, value, warning }: { icon: ComponentType<{ className?: string }>; label: string; value: string; warning?: boolean }) { return <div className={dataDisplayRecipes.metricCompact}><p className={dataDisplayRecipes.metricCompactLabel}><Icon className={warning ? styles.warningIcon : styles.metricIcon} />{label}</p><p className={dataDisplayRecipes.metricCompactValue}>{value}</p></div>; }
function Info({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) { return <div className={dataDisplayRecipes.compactDatum}><p className={dataDisplayRecipes.compactDatumLabel}><Icon className={styles.smallIcon} />{label}</p><p className={dataDisplayRecipes.compactDatumValue}>{value}</p></div>; }
function Datum({ label, value }: { label: string; value: string }) { return <div><dt className={dataDisplayRecipes.flatDatumLabel}>{label}</dt><dd className={dataDisplayRecipes.flatDatumValue}>{value}</dd></div>; }
function DocumentStatus({ status }: { status: string }) { return status === "DOCUMENTOS_CARGADOS" ? <span className={statusRecipes.success}><CheckCircle2 className="h-3.5 w-3.5" />Documentos cargados</span> : <span className={statusRecipes.warning}><AlertTriangle className="h-3.5 w-3.5" />Faltan documentos</span>; }
function Money({ value }: { value: number }) { return <TableCell className={`text-right ${dataDisplayRecipes.numericCell}`}>{formatCurrencyCOP(value)}</TableCell>; }
function TableCell({ className = "", children }: { className?: string; children: ReactNode }) { return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>; }
function TableHead({ className = "", children }: { className?: string; children: ReactNode }) { return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>; }
