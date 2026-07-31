"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  Bell,
  Calculator,
  CreditCard,
  Menu,
  PlusCircle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import styles from "./dashboard-topbar.module.css";

interface DashboardTopbarUser {
  nombre: string;
  email: string;
  image: string | null;
  roles: string[];
  roleNames: string[];
}

interface DashboardTopbarProps {
  user: DashboardTopbarUser;
  drawerOpen: boolean;
  onMenuClick: () => void;
}

interface SectionMetadata {
  title: string;
  description: string;
  icon: LucideIcon;
  backHref?: string;
  backLabel?: string;
}

/** Contextual topbar with Lopest identity and database-backed user labels. */
export function DashboardTopbar({
  user,
  drawerOpen,
  onMenuClick,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const section = useMemo(() => getSectionMetadata(pathname), [pathname]);
  const roleLabel = user.roleNames.length > 0
    ? user.roleNames.join(" · ")
    : "Usuario";
  const initials = getInitials(user.nombre || user.email);
  const MenuIcon = drawerOpen ? X : Menu;
  const SectionIcon = section.icon;

  return (
    <header className={styles.topbar}>
      <div className={styles.contextArea}>
        <button
          type="button"
          className={`${styles.tabletMenuButton} ${styles.iconButton}`}
          onClick={onMenuClick}
          aria-label={drawerOpen ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={drawerOpen}
          aria-controls="dashboard-navigation-drawer"
        >
          <MenuIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        {section.backHref ? (
          <Link
            href={section.backHref}
            className={styles.backButton}
            aria-label={section.backLabel ?? "Volver"}
            title={section.backLabel ?? "Volver"}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}

        <div className={styles.sectionIcon} aria-hidden="true">
          <SectionIcon className="h-5 w-5" />
        </div>

        <div className={styles.sectionText}>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
          <span className={styles.titleAccent} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.accountArea}>
        <button type="button" className={styles.notificationButton} aria-label="Notificaciones">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className={styles.accountIdentity} aria-label={`Cuenta: ${user.nombre || user.email}. ${roleLabel}`}>
          <span className={styles.accountText}>
            <strong>{user.nombre || user.email}</strong>
            <span>{roleLabel}</span>
          </span>
          <span className={styles.avatar}>
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              initials
            )}
          </span>
        </div>
      </div>
    </header>
  );
}

function getSectionMetadata(pathname: string): SectionMetadata {
  const clientEdit = pathname.match(/^\/clientes\/([^/]+)\/editar/);
  if (clientEdit) return { title: "Editar cliente", description: "Actualiza la información principal y de contacto.", icon: Users, backHref: `/clientes/${clientEdit[1]}`, backLabel: "Volver al cliente" };
  if (pathname.startsWith("/clientes/nuevo")) return { title: "Nuevo cliente", description: "Registra un cliente y su información principal.", icon: PlusCircle, backHref: "/clientes", backLabel: "Volver a clientes" };
  const clientDetail = pathname.match(/^\/clientes\/([^/]+)$/);
  if (clientDetail) return { title: "Detalle del cliente", description: "Información, cartera y documentos asociados.", icon: Users, backHref: "/clientes", backLabel: "Volver a clientes" };
  const creditEdit = pathname.match(/^\/creditos\/([^/]+)\/editar/);
  if (creditEdit) return { title: "Editar crédito", description: "Ajusta la información permitida del crédito.", icon: CreditCard, backHref: `/creditos/${creditEdit[1]}`, backLabel: "Volver al crédito" };
  if (pathname.startsWith("/creditos/nuevo")) return { title: "Nuevo crédito", description: "Define las condiciones y el cronograma inicial.", icon: PlusCircle, backHref: "/creditos", backLabel: "Volver a créditos" };
  const creditDetail = pathname.match(/^\/creditos\/([^/]+)$/);
  if (creditDetail) return { title: "Detalle del crédito", description: "Consulta cronograma, pagos, abonos y movimientos.", icon: CreditCard, backHref: "/creditos", backLabel: "Volver a créditos" };
  if (pathname.startsWith("/transferencias")) return { title: "Transferencias de cartera", description: "Mueve clientes o créditos entre cuentas autorizadas.", icon: ArrowRightLeft };
  if (pathname.startsWith("/creditos")) return { title: "Créditos", description: "Consulta y administra la cartera de créditos.", icon: CreditCard };
  if (pathname.startsWith("/clientes")) return { title: "Clientes", description: "Gestiona clientes, contacto y cartera asociada.", icon: Users };
  if (pathname.startsWith("/simulador")) return { title: "Simulador", description: "Evalúa condiciones y cronogramas de crédito.", icon: Calculator };
  if (pathname.startsWith("/reportes")) return { title: "Reportes", description: "Indicadores y reportes financieros.", icon: BarChart3 };
  return { title: "Dashboard", description: "Resumen operativo de Lopest.", icon: BarChart3 };
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}
