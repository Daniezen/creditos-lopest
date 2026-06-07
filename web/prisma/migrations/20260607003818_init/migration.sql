-- CreateEnum
CREATE TYPE "EstadoDocumentos" AS ENUM ('FALTAN_DOCUMENTOS', 'DOCUMENTOS_CARGADOS');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FrecuenciaPago" AS ENUM ('MENSUAL', 'QUINCENAL_5_20', 'QUINCENAL_10_25', 'QUINCENAL_15_30');

-- CreateEnum
CREATE TYPE "TipoAmortizacion" AS ENUM ('AMORTIZACION_FIJA', 'SOLO_INTERES');

-- CreateEnum
CREATE TYPE "TipoEventoFinanciero" AS ENUM ('CUOTA_PROGRAMADA', 'ABONO_CAPITAL');

-- CreateEnum
CREATE TYPE "EstadoEventoFinanciero" AS ENUM ('PENDIENTE', 'ATRASADO', 'MORA', 'PAGADO', 'CANCELADO_POR_ABONO');

-- CreateEnum
CREATE TYPE "ProveedorArchivo" AS ENUM ('GOOGLE_DRIVE', 'LOCAL', 'S3', 'OTRO');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "empresa" TEXT,
    "telefono" TEXT,
    "recomienda" TEXT,
    "contacto" TEXT,
    "contacto2" TEXT,
    "carpetaAdjuntosUrl" TEXT,
    "estadoDocumentos" "EstadoDocumentos" NOT NULL DEFAULT 'FALTAN_DOCUMENTOS',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "accionPor" TEXT,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaPrestamo" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "tasaMensual" DECIMAL(10,6) NOT NULL,
    "frecuencia" "FrecuenciaPago" NOT NULL,
    "tipoAmortizacion" "TipoAmortizacion" NOT NULL DEFAULT 'AMORTIZACION_FIJA',
    "estado" "EstadoCredito" NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT,
    "nota" TEXT,
    "fechaCancelacion" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "accionPor" TEXT,

    CONSTRAINT "creditos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_financieros" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "numeroCuota" INTEGER,
    "tipo" "TipoEventoFinanciero" NOT NULL DEFAULT 'CUOTA_PROGRAMADA',
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "valorProgramado" DECIMAL(18,2) NOT NULL,
    "capitalProgramado" DECIMAL(18,2) NOT NULL,
    "interesProgramado" DECIMAL(18,2) NOT NULL,
    "montoPagado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "capitalPagado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interesPagado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldoCapitalPost" DECIMAL(18,2),
    "estado" "EstadoEventoFinanciero" NOT NULL DEFAULT 'PENDIENTE',
    "diasAtraso" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "accionPor" TEXT,

    CONSTRAINT "eventos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias_credito" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_cliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "url" TEXT NOT NULL,
    "proveedor" "ProveedorArchivo" NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "accionPor" TEXT,

    CONSTRAINT "documentos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cedula_key" ON "clientes"("cedula");

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes"("nombre");

-- CreateIndex
CREATE INDEX "clientes_telefono_idx" ON "clientes"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_codigo_key" ON "creditos"("codigo");

-- CreateIndex
CREATE INDEX "creditos_clienteId_idx" ON "creditos"("clienteId");

-- CreateIndex
CREATE INDEX "creditos_codigo_idx" ON "creditos"("codigo");

-- CreateIndex
CREATE INDEX "creditos_estado_idx" ON "creditos"("estado");

-- CreateIndex
CREATE INDEX "creditos_fechaPrestamo_idx" ON "creditos"("fechaPrestamo");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_financieros_codigo_key" ON "eventos_financieros"("codigo");

-- CreateIndex
CREATE INDEX "eventos_financieros_creditoId_idx" ON "eventos_financieros"("creditoId");

-- CreateIndex
CREATE INDEX "eventos_financieros_tipo_idx" ON "eventos_financieros"("tipo");

-- CreateIndex
CREATE INDEX "eventos_financieros_estado_idx" ON "eventos_financieros"("estado");

-- CreateIndex
CREATE INDEX "eventos_financieros_fechaProgramada_idx" ON "eventos_financieros"("fechaProgramada");

-- CreateIndex
CREATE INDEX "eventos_financieros_fechaPago_idx" ON "eventos_financieros"("fechaPago");

-- CreateIndex
CREATE INDEX "eventos_financieros_creditoId_numeroCuota_idx" ON "eventos_financieros"("creditoId", "numeroCuota");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_credito_anio_key" ON "secuencias_credito"("anio");

-- CreateIndex
CREATE INDEX "documentos_cliente_clienteId_idx" ON "documentos_cliente"("clienteId");

-- AddForeignKey
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_financieros" ADD CONSTRAINT "eventos_financieros_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_cliente" ADD CONSTRAINT "documentos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
