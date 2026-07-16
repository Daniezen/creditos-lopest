import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pagePath = join(root, "web/src/app/(dashboard)/creditos/[id]/page.tsx");

if (!existsSync(pagePath)) {
  throw new Error(`Falta archivo requerido: ${pagePath}`);
}

let page = readFileSync(pagePath, "utf8");

// Remove imports that belonged to the separate quota and principal-payment renderers.
page = page.replace(
  /import \{\s*registrarPagoCuota,\s*reversarPagoCuota,\s*\} from "@\/features\/creditos\/pagos\/actions";\n/,
  "",
);
page = page.replace(
  'import { AbonosHistory } from "@/features/creditos/abonos/components/abonos-history";\n',
  "",
);
page = page.replace(
  'import { EditPaymentDate } from "@/features/creditos/pagos/components/edit-payment-date";\n',
  "",
);

const queriesImport = 'import { obtenerCreditoDetalle } from "@/features/creditos/queries";';
const movementsImport = 'import { CreditMovements } from "@/features/creditos/components/credit-movements";';

if (!page.includes(movementsImport)) {
  if (!page.includes(queriesImport)) {
    throw new Error("No se encontro el import de obtenerCreditoDetalle.");
  }

  page = page.replace(queriesImport, `${movementsImport}\n${queriesImport}`);
}

// Remove the derived arrays previously used by the two independent sections.
const cuotasStart = page.indexOf("  const cuotas = credito.eventos.filter(");
const montoStart = page.indexOf("  const monto = Number(credito.monto);", cuotasStart);

if (cuotasStart !== -1) {
  if (montoStart === -1) {
    throw new Error("Se encontro const cuotas, pero no el bloque const monto posterior.");
  }

  page = page.slice(0, cuotasStart) + page.slice(montoStart);
}

// Remove the independent principal-payment history component invocation.
page = page.replace(/\n\s*<AbonosHistory abonos=\{abonos\} \/>\n/, "\n");

// Replace the last section before </main>. In the current page this is the Cuotas
// section. Using the last section avoids fragile matching against full class strings.
if (!page.includes("<CreditMovements")) {
  const mainEnd = page.indexOf("    </main>");
  if (mainEnd === -1) {
    throw new Error("No se encontro el cierre de <main> en el detalle del credito.");
  }

  const sectionStart = page.lastIndexOf("      <section", mainEnd);
  const sectionClose = page.lastIndexOf("      </section>", mainEnd);

  if (sectionStart === -1 || sectionClose === -1 || sectionClose < sectionStart) {
    throw new Error("No se pudo delimitar la ultima seccion del detalle del credito.");
  }

  const sectionEnd = sectionClose + "      </section>".length;
  const replacement = `      <CreditMovements
        creditoId={credito.id}
        montoInicial={monto}
        eventos={credito.eventos}
      />`;

  page = page.slice(0, sectionStart) + replacement + page.slice(sectionEnd);
}

// Remove helper functions that were only used by the old inline table/cards.
const obsoleteHelpersStart = page.indexOf("interface CompactFieldProps");
const preservedHelpersStart = page.indexOf("function formatFrecuencia", obsoleteHelpersStart);

if (obsoleteHelpersStart !== -1) {
  if (preservedHelpersStart === -1) {
    throw new Error("No se encontro function formatFrecuencia despues de los helpers obsoletos.");
  }

  page = page.slice(0, obsoleteHelpersStart) + page.slice(preservedHelpersStart);
}

if (page.includes("<AbonosHistory") || page.includes("const abonos =")) {
  throw new Error("Quedaron referencias al historial independiente de abonos.");
}

if (!page.includes("<CreditMovements")) {
  throw new Error("No se inserto CreditMovements en el detalle del credito.");
}

writeFileSync(pagePath, page, "utf8");

console.log("[OK] Ultima seccion del detalle reemplazada por CreditMovements.");
console.log("[OK] Historial independiente de abonos removido.");
console.log("[OK] Imports y helpers obsoletos limpiados.");
