import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pagePath = join(root, "web/src/app/(dashboard)/creditos/[id]/page.tsx");

if (!existsSync(pagePath)) {
  throw new Error(`Falta archivo requerido: ${pagePath}`);
}

let page = readFileSync(pagePath, "utf8");

const detailImport = 'import { obtenerCreditoDetalle } from "@/features/creditos/queries";';
const historyImport = 'import { AbonosHistory } from "@/features/creditos/abonos/components/abonos-history";';

if (!page.includes(historyImport)) {
  if (!page.includes(detailImport)) {
    throw new Error("No se encontró el import de obtenerCreditoDetalle.");
  }
  page = page.replace(detailImport, `${historyImport}\n${detailImport}`);
}

const cuotasBlock = `  const cuotas = credito.eventos.filter(
    (evento) => evento.tipo === "CUOTA_PROGRAMADA",
  );`;

const cuotasAndAbonosBlock = `  const cuotas = credito.eventos.filter(
    (evento) => evento.tipo === "CUOTA_PROGRAMADA",
  );

  const abonos = credito.eventos
    .filter((evento) => evento.tipo === "ABONO_CAPITAL")
    .sort((a, b) => {
      const fechaA = a.fechaPago ?? a.fechaProgramada;
      const fechaB = b.fechaPago ?? b.fechaProgramada;
      return fechaB.getTime() - fechaA.getTime();
    });`;

if (!page.includes("const abonos = credito.eventos")) {
  if (!page.includes(cuotasBlock)) {
    throw new Error("No se encontró el bloque de cuotas en el detalle del crédito.");
  }
  page = page.replace(cuotasBlock, cuotasAndAbonosBlock);
}

const oldSaldoBlock = `  const saldoActual = cuotas.reduce((saldo, evento) => {
    if (evento.saldoCapitalPost === null) {
      return saldo;
    }

    return Number(evento.saldoCapitalPost);
  }, monto);`;

const newSaldoBlock = `  // The current balance must come from the latest effective paid event, not
  // from the final projected installment. In Solo Interés schedules, the last
  // future installment legitimately projects saldoCapitalPost = 0.
  const ultimoEventoPagadoConSaldo = [...credito.eventos]
    .filter(
      (evento) =>
        evento.estado === "PAGADO" && evento.saldoCapitalPost !== null,
    )
    .sort((a, b) => {
      const fechaA = a.fechaPago ?? a.fechaProgramada;
      const fechaB = b.fechaPago ?? b.fechaProgramada;
      return fechaB.getTime() - fechaA.getTime();
    })[0];

  const saldoActual = ultimoEventoPagadoConSaldo
    ? Number(ultimoEventoPagadoConSaldo.saldoCapitalPost)
    : monto;`;

if (page.includes(oldSaldoBlock)) {
  page = page.replace(oldSaldoBlock, newSaldoBlock);
} else if (!page.includes("const ultimoEventoPagadoConSaldo")) {
  throw new Error("No se encontró el cálculo actual de saldo para reemplazarlo.");
}

if (!page.includes("<AbonosHistory abonos={abonos} />")) {
  const sectionTitle = "Abono extraordinario a capital";
  const titlePos = page.indexOf(sectionTitle);
  if (titlePos === -1) {
    throw new Error("No se encontró la sección para registrar abono extraordinario.");
  }

  const sectionEnd = page.indexOf("      </section>", titlePos);
  if (sectionEnd === -1) {
    throw new Error("No se pudo determinar el final de la sección de registro de abono.");
  }

  const insertAt = sectionEnd + "      </section>".length;
  page = `${page.slice(0, insertAt)}\n\n      <AbonosHistory abonos={abonos} />${page.slice(insertAt)}`;
}

writeFileSync(pagePath, page, "utf8");

console.log("[OK] Historial de abonos extraordinarios agregado al detalle.");
console.log("[OK] Saldo del detalle corregido para usar el último evento pagado con saldo.");
console.log("[OK] Cuotas y abonos permanecen como tipos de movimiento separados.");
