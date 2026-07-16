import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const movementsPath = join(
  root,
  "web/src/features/creditos/components/credit-movements.tsx",
);
const sidebarPath = join(
  root,
  "web/src/components/dashboard/sidebar.tsx",
);

for (const path of [movementsPath, sidebarPath]) {
  if (!existsSync(path)) throw new Error(`Falta archivo requerido: ${path}`);
}

let movements = readFileSync(movementsPath, "utf8");

const functionStart = movements.indexOf("function buildDisplayMovements(");
const nextDocStart = movements.indexOf("/**\n * Renders scheduled installments", functionStart);

if (functionStart === -1 || nextDocStart === -1) {
  throw new Error("No se pudo delimitar buildDisplayMovements.");
}

const replacement = `function buildDisplayMovements(
  eventos: CreditMovementEvent[],
  montoInicial: number,
): DisplayMovement[] {
  const paidEvents = [...eventos]
    .filter((evento) => evento.estado === "PAGADO")
    .sort((left, right) => {
      const leftDate = left.fechaPago ?? left.fechaProgramada;
      const rightDate = right.fechaPago ?? right.fechaProgramada;
      const dateDifference = leftDate.getTime() - rightDate.getTime();

      return dateDifference !== 0
        ? dateDifference
        : left.creadoEn.getTime() - right.creadoEn.getTime();
    });

  // Realized balances must be calculated chronologically, independently from
  // presentation order. Otherwise moving abonos to the end would corrupt their
  // derived historical balances when installments and abonos are interleaved.
  const realizedBalanceByEventId = new Map<string, number>();
  let realizedBalance = montoInicial;

  for (const evento of paidEvents) {
    const storedBalance =
      evento.saldoCapitalPost === null
        ? null
        : Number(evento.saldoCapitalPost);

    realizedBalance =
      storedBalance ??
      Math.max(0, realizedBalance - Number(evento.capitalPagado || 0));
    realizedBalanceByEventId.set(evento.id, realizedBalance);
  }

  const displayEvents = [...eventos].sort((left, right) => {
    const leftIsInstallment = left.tipo === "CUOTA_PROGRAMADA";
    const rightIsInstallment = right.tipo === "CUOTA_PROGRAMADA";

    if (leftIsInstallment && rightIsInstallment) {
      return Number(left.numeroCuota ?? 0) - Number(right.numeroCuota ?? 0);
    }

    if (leftIsInstallment) return -1;
    if (rightIsInstallment) return 1;

    const leftDate = left.fechaPago ?? left.fechaProgramada;
    const rightDate = right.fechaPago ?? right.fechaProgramada;
    const dateDifference = leftDate.getTime() - rightDate.getTime();

    return dateDifference !== 0
      ? dateDifference
      : left.creadoEn.getTime() - right.creadoEn.getTime();
  });

  return displayEvents.map((evento) => ({
    evento,
    saldoMostrado:
      evento.estado === "PAGADO"
        ? (realizedBalanceByEventId.get(evento.id) ?? null)
        : evento.saldoCapitalPost === null
          ? null
          : Number(evento.saldoCapitalPost),
  }));
}

`;

movements =
  movements.slice(0, functionStart) +
  replacement +
  movements.slice(nextDocStart);

movements = movements.replace(
  "Cuotas programadas y abonos extraordinarios ordenados por fecha.",
  "Cuotas en orden contractual y abonos extraordinarios al final.",
);
movements = movements.replace(
  'className="min-w-[920px] w-full table-fixed',
  'className="w-full table-fixed',
);

const widthReplacements = new Map([
  ['className="w-[90px]"', 'className="w-[10%]"'],
  ['className="w-[118px]"', 'className="w-[12%]"'],
  ['className="w-[110px] text-right"', 'className="w-[12%] text-right"'],
  ['className="w-[165px] text-right"', 'className="w-[17%] text-right"'],
  ['className="w-[145px] text-right"', 'className="w-[17%] text-right"'],
  ['className="w-[105px]"', 'className="w-[11%]"'],
  ['className="w-[85px] text-center"', 'className="w-[9%] text-center"'],
]);

for (const [before, after] of widthReplacements) {
  movements = movements.replaceAll(before, after);
}

movements = movements.replace(
  "Fecha<br />Programada",
  "Programada",
);
movements = movements.replace(
  "Fecha Real<br />de Pago",
  "Fecha de pago",
);
movements = movements.replace(
  "Valor<br />Movimiento",
  "Valor",
);
movements = movements.replace(
  `Parte que se<br />convierte en abono a{" "}
                <span className="font-black text-blue-700">intereses</span>`,
  `<span className="font-black text-blue-700">Intereses</span>`,
);
movements = movements.replace(
  `Saldo crédito<br />
                <span className="font-black text-green-700">(capital)</span><br />
                después del movimiento`,
  `<span className="font-black text-green-700">Saldo capital</span>`,
);
movements = movements.replace(
  "whitespace-nowrap px-5 py-4 text-slate-700",
  "whitespace-nowrap px-2 py-3 text-slate-700 xl:px-3",
);
movements = movements.replace(
  "whitespace-normal px-4 py-3 text-left",
  "whitespace-normal px-2 py-3 text-left xl:px-3",
);

writeFileSync(movementsPath, movements, "utf8");

let sidebar = readFileSync(sidebarPath, "utf8");
sidebar = sidebar.replace(
  'isDenseRoute ? "h-14 w-14" : "h-16 w-16"',
  'isDenseRoute ? "h-10 w-10" : "h-16 w-16"',
);
writeFileSync(sidebarPath, sidebar, "utf8");

console.log("[OK] Cuotas ordenadas siempre por numeroCuota.");
console.log("[OK] Abonos ubicados al final y ordenados por fecha.");
console.log("[OK] Calculo cronologico de saldos desacoplado del orden visual.");
console.log("[OK] Tabla convertida a ancho proporcional sin min-width fijo.");
console.log("[OK] Logo de sidebar densa reducido a 40px.");
