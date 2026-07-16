import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const paths = {
  createPage: join(root, "web/src/features/creditos/crear/create-credit-page-content.tsx"),
  confirmation: join(root, "web/src/features/creditos/crear/components/confirmation-step.tsx"),
  createActions: join(root, "web/src/features/creditos/crear/actions.ts"),
  detailPage: join(root, "web/src/app/(dashboard)/creditos/[id]/page.tsx"),
  movements: join(root, "web/src/features/creditos/components/credit-movements.tsx"),
  editPage: join(root, "web/src/app/(dashboard)/creditos/[id]/editar/page.tsx"),
  editForm: join(root, "web/src/features/creditos/editar/credit-edit-form.tsx"),
  editActions: join(root, "web/src/features/creditos/editar/actions.ts"),
};

for (const path of Object.values(paths)) {
  if (!existsSync(path)) throw new Error(`Falta archivo requerido: ${path}`);
}

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`No se encontro: ${label}`);
  return text.replace(before, after);
}

function write(path, text) {
  writeFileSync(path, text, "utf8");
}

// ---------------------------------------------------------------------------
// Creation wizard: note is non-financial state owned by the creation flow.
// ---------------------------------------------------------------------------
let createPage = readFileSync(paths.createPage, "utf8");
createPage = replaceRequired(
  createPage,
  '  const [saveError, setSaveError] = useState<string | null>(null);',
  '  const [saveError, setSaveError] = useState<string | null>(null);\n  const [nota, setNota] = useState("");',
  "creation note state",
);
createPage = replaceRequired(
  createPage,
  `        form,
        idempotencyKey,`,
  `        form,
        nota,
        idempotencyKey,`,
  "note in create action payload",
);
createPage = replaceRequired(
  createPage,
  `    resetForm();
    setSelectedCliente(null);`,
  `    resetForm();
    setNota("");
    setSelectedCliente(null);`,
  "note reset",
);
createPage = replaceRequired(
  createPage,
  `              resultado={resultado}
              error={saveError}`,
  `              resultado={resultado}
              nota={nota}
              onNotaChange={setNota}
              error={saveError}`,
  "note props for confirmation",
);
write(paths.createPage, createPage);

// ---------------------------------------------------------------------------
// Confirmation step: compact editable note, visible before committing.
// ---------------------------------------------------------------------------
let confirmation = readFileSync(paths.confirmation, "utf8");
confirmation = confirmation.replace(
  "  UserRound,\n} from \"lucide-react\";",
  "  UserRound,\n  StickyNote,\n} from \"lucide-react\";",
);
confirmation = replaceRequired(
  confirmation,
  `  resultado: SimulationResult;
  error: string | null;`,
  `  resultado: SimulationResult;
  nota: string;
  onNotaChange: (value: string) => void;
  error: string | null;`,
  "confirmation note props",
);
confirmation = replaceRequired(
  confirmation,
  `  resultado,
  error,`,
  `  resultado,
  nota,
  onNotaChange,
  error,`,
  "confirmation note destructuring",
);
const confirmationInsert = `
        <label className="mt-5 block rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <StickyNote className="h-4 w-4 text-violet-600" />
            Nota opcional
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Información útil para el seguimiento del crédito. Podrás editarla después.
          </span>
          <textarea
            value={nota}
            maxLength={1000}
            rows={3}
            onChange={(event) => onNotaChange(event.target.value)}
            placeholder="Ej.: Paga quincenal $150.000. Inicia pagos el 15/02/2026."
            className="mt-3 w-full resize-y rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
          />
          <span className="mt-1 block text-right text-[11px] text-slate-400">
            {nota.length}/1000
          </span>
        </label>
`;
if (!confirmation.includes('Nota opcional')) {
  const errorMarker = "        {error ? (";
  const index = confirmation.indexOf(errorMarker);
  if (index === -1) throw new Error("No se encontro el bloque de error en ConfirmationStep");
  confirmation = confirmation.slice(0, index) + confirmationInsert + "\n" + confirmation.slice(index);
}
write(paths.confirmation, confirmation);

// ---------------------------------------------------------------------------
// Creation action: server-side normalization and atomic persistence.
// ---------------------------------------------------------------------------
let createActions = readFileSync(paths.createActions, "utf8");
createActions = replaceRequired(
  createActions,
  `  form: SimulatorFormState;
  idempotencyKey: string;`,
  `  form: SimulatorFormState;
  nota?: string;
  idempotencyKey: string;`,
  "create input note",
);
createActions = replaceRequired(
  createActions,
  `  const idempotencyKey = input.idempotencyKey.trim();`,
  `  const idempotencyKey = input.idempotencyKey.trim();
  const nota = input.nota?.trim() || null;

  if (nota && nota.length > 1000) {
    return { ok: false, error: "La nota no puede superar 1000 caracteres." };
  }`,
  "server note normalization",
);
createActions = replaceRequired(
  createActions,
  `          ownerUserId: user.id,
          accionPor: user.id,`,
  `          ownerUserId: user.id,
          nota,
          accionPor: user.id,`,
  "persist create note",
);
// Remove the duplicated legacy owner repair block while retaining one copy.
const duplicatedOwnerRepair = `        if (!creditoExistente.ownerUserId) {
          await tx.credito.update({
            where: {
              id: creditoExistente.id,
            },
            data: {
              ownerUserId: user.id,
              accionPor: user.id,
            },
          });
        }

        if (!creditoExistente.ownerUserId) {
          await tx.credito.update({
            where: {
              id: creditoExistente.id,
            },
            data: {
              ownerUserId: user.id,
              accionPor: user.id,
            },
          });
        }`;
const singleOwnerRepair = `        if (!creditoExistente.ownerUserId) {
          await tx.credito.update({
            where: {
              id: creditoExistente.id,
            },
            data: {
              ownerUserId: user.id,
              accionPor: user.id,
            },
          });
        }`;
createActions = createActions.replace(duplicatedOwnerRepair, singleOwnerRepair);
write(paths.createActions, createActions);

// ---------------------------------------------------------------------------
// Edit flow: observation becomes computed-only; note remains editable.
// ---------------------------------------------------------------------------
let editPage = readFileSync(paths.editPage, "utf8");
editPage = editPage.replace('        observaciones={credito.observaciones ?? ""}\n', "");
write(paths.editPage, editPage);

let editForm = readFileSync(paths.editForm, "utf8");
editForm = editForm.replace('  observaciones: string;\n', "");
editForm = editForm.replace('  observaciones,\n', "");
editForm = editForm.replace(
  `  const [notes, setNotes] = useState({
    observaciones,
    nota,
  });`,
  `  const [note, setNote] = useState(nota);`,
);
editForm = editForm.replace(
  `        observaciones: notes.observaciones,
        nota: notes.nota,`,
  `        nota: note,`,
);
// Replace the two-column notes area with a single compact note editor.
const notesAreaStart = editForm.indexOf('      <div className="mt-5 grid gap-4 sm:grid-cols-2">');
const notesAreaEndMarker = "      </div>";
if (notesAreaStart !== -1 && editForm.includes('label="Observaciones"', notesAreaStart)) {
  const notesAreaEnd = editForm.indexOf(notesAreaEndMarker, editForm.indexOf('label="Nota"', notesAreaStart));
  if (notesAreaEnd === -1) throw new Error("No se pudo delimitar el area de notas en edit form");
  const replacement = `      <div className="mt-5">
        <TextArea
          label="Nota"
          value={note}
          onChange={setNote}
        />
      </div>`;
  editForm = editForm.slice(0, notesAreaStart) + replacement + editForm.slice(notesAreaEnd + notesAreaEndMarker.length);
}
write(paths.editForm, editForm);

let editActions = readFileSync(paths.editActions, "utf8");
editActions = editActions.replace('  observaciones?: string;\n', "");
editActions = editActions.replaceAll('            observaciones: input.observaciones?.trim() || null,\n', "");
editActions = editActions.replaceAll('          observaciones: input.observaciones?.trim() || null,\n', "");
write(paths.editActions, editActions);

// ---------------------------------------------------------------------------
// Detail: computed operational observation, stored note and clearer copy.
// ---------------------------------------------------------------------------
let detail = readFileSync(paths.detailPage, "utf8");
detail = detail.replace(
  "  WalletCards,\n} from \"lucide-react\";",
  "  WalletCards,\n  Activity,\n  StickyNote,\n} from \"lucide-react\";",
);
const operationalComputation = `
  const cuotasEfectivas = credito.eventos.filter(
    (evento) =>
      evento.tipo === "CUOTA_PROGRAMADA" &&
      evento.estado !== "CANCELADO_POR_ABONO",
  );
  const cuotasPagadas = cuotasEfectivas.filter(
    (evento) => evento.estado === "PAGADO",
  ).length;
  const tieneMora = cuotasEfectivas.some((evento) => evento.estado === "MORA");
  const tieneAtraso = cuotasEfectivas.some(
    (evento) => evento.estado === "ATRASADO",
  );
  const estadoOperativo = tieneMora
    ? "En mora"
    : tieneAtraso
      ? "Atrasado"
      : credito.estado === "CANCELADO"
        ? "Pagado"
        : "Al día";
  const observacionOperativa =
    "Pagado: " +
    cuotasPagadas +
    "/" +
    cuotasEfectivas.length +
    " · Saldo: " +
    formatCurrencyCOP(saldoActual) +
    " · " +
    estadoOperativo;
`;
if (!detail.includes("const observacionOperativa")) {
  const returnMarker = "\n  return (";
  const index = detail.indexOf(returnMarker);
  if (index === -1) throw new Error("No se encontro return del detalle");
  detail = detail.slice(0, index) + operationalComputation + detail.slice(index);
}
const infoStrip = `
        <section className="grid gap-3 border-t border-violet-100 px-5 pb-5 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <OperationalInfo
            icon={Activity}
            label="Observación operativa"
            value={observacionOperativa}
          />
          <OperationalInfo
            icon={StickyNote}
            label="Nota"
            value={credito.nota?.trim() || "Sin nota registrada"}
            muted={!credito.nota?.trim()}
          />
        </section>
`;
if (!detail.includes('label="Observación operativa"')) {
  const headerClose = "      </header>";
  const index = detail.indexOf(headerClose);
  if (index === -1) throw new Error("No se encontro cierre del header de detalle");
  detail = detail.slice(0, index) + infoStrip + detail.slice(index);
}
const oldAbonoExplanation = "En amortización fija reduce plazo atacando cuotas futuras desde la cola. En solo interés reduce la basede capital y recalcula intereses futuros.";
const dynamicAbonoExplanation = `{credito.tipoAmortizacion === "SOLO_INTERES"
                ? "El abono reduce el capital pendiente. Los próximos intereses se calculan sobre el nuevo saldo."
                : "El abono reduce el capital pendiente y acorta el crédito, empezando por las últimas cuotas."}`;
detail = detail.replace(oldAbonoExplanation, dynamicAbonoExplanation);

const helperMarker = "interface MetricCardProps {";
if (!detail.includes("function OperationalInfo(")) {
  const index = detail.indexOf(helperMarker);
  if (index === -1) throw new Error("No se encontro MetricCardProps para insertar helper");
  const helper = `interface OperationalInfoProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}

function OperationalInfo({
  icon: Icon,
  label,
  value,
  muted = false,
}: OperationalInfoProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-violet-100 bg-violet-50/35 px-4 py-3">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        {label}
      </p>
      <p
        className={[
          "mt-1.5 line-clamp-2 text-sm leading-5",
          muted ? "text-slate-400" : "font-medium text-slate-800",
        ].join(" ")}
        title={value}
      >
        {value}
      </p>
    </article>
  );
}

`;
  detail = detail.slice(0, index) + helper + detail.slice(index);
}
write(paths.detailPage, detail);

// ---------------------------------------------------------------------------
// Remove redundant movement description but preserve counts and title.
// ---------------------------------------------------------------------------
let movements = readFileSync(paths.movements, "utf8");
movements = movements.replace(
  `          <p className="mt-1 text-sm text-slate-500">
            Cuotas en orden contractual y abonos extraordinarios al final.
          </p>
`,
  "",
);
write(paths.movements, movements);

console.log("[OK] Nota agregada a creacion, confirmacion y persistencia atomica.");
console.log("[OK] Observacion manual retirada de edicion; ahora es calculada.");
console.log("[OK] Observacion operativa y nota agregadas al detalle en franja compacta.");
console.log("[OK] Explicacion de abono simplificada y adaptada al tipo de credito.");
console.log("[OK] Descripcion redundante del cronograma eliminada.");
console.log("[OK] Bloque duplicado de reparacion de owner eliminado.");
