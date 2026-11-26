-- Casa y Negocio: memory of the avisos already sent by Telegram.
--
-- The daily cron (/api/cron/casa-negocio-avisos, called by n8n) evaluates
-- today's avisos and must report only the NEW ones; without memory the same
-- "Arriendo sin pagar" would reach the family's chat every morning. One row
-- per aviso identity (rule + month + element, see avisos-envio.ts):
--   * resueltoEn NULL  -> the aviso was active at the last run;
--   * resueltoEn set   -> it stopped applying; if it comes back it is new again.
-- `refs` keeps the ids behind an aggregated aviso (rule 8 lists credits), so a
-- credit joining the list is news but one leaving it is not.
--
-- Purely additive: one new table, no FK to existing tables, no data touched.
-- Locks: CREATE TABLE / CREATE INDEX on a new, empty object only.
--
-- Manual rollback (nothing depends on this table):
--   DROP TABLE "cn_avisos_enviados";
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261127120000_casa_negocio_avisos_enviados';

-- CreateTable
CREATE TABLE "cn_avisos_enviados" (
    "clave" TEXT NOT NULL,
    "codigo" "CnCodigoAviso" NOT NULL,
    "mes" TEXT NOT NULL,
    "elemento" TEXT NOT NULL,
    "refs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "texto" TEXT NOT NULL,
    "primeraVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMP(3) NOT NULL,
    "vistoEn" TIMESTAMP(3) NOT NULL,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "cn_avisos_enviados_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "cn_avisos_enviados_resueltoEn_idx" ON "cn_avisos_enviados"("resueltoEn");
