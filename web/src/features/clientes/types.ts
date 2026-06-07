import type { EstadoDocumentos } from "@prisma/client";

/**
 * Cliente reducido para selectores de UI.
 *
 * Incluye los campos principales heredados de la hoja Clientes:
 * - cedula
 * - cliente/nombre
 * - direccion
 * - empresa
 * - telefono
 * - recomienda
 * - contacto
 * - contacto2
 * - carpeta de adjuntos
 * - estado documental
 *
 * No exponemos columnas financieras aquí. El objetivo es seleccionar o crear
 * cliente para flujos como creación de crédito.
 */
export interface ClienteSelectorOption {
  id: string;
  cedula: string;
  nombre: string;

  direccion: string | null;
  empresa: string | null;
  telefono: string | null;
  recomienda: string | null;
  contacto: string | null;
  contacto2: string | null;

  carpetaAdjuntosUrl: string | null;
  estadoDocumentos: EstadoDocumentos;
}