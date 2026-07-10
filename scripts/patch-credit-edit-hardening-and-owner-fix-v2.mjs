import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const paths = {
  createActions: join(root, "web/src/features/creditos/crear/actions.ts"),
  editActions: join(root, "web/src/features/creditos/editar/actions.ts"),
  editForm: join(root, "web/src/features/creditos/editar/credit-edit-form.tsx"),
};

for (const [label, path] of Object.entries(paths)) {
  if (!existsSync(path)) {
    throw new Error(`Falta archivo requerido (${label}): ${path}`);
  }
}

function writeIfChanged(path, next) {
  const current = readFileSync(path, "utf8");
  if (current !== next) {
    writeFileSync(path, next, "utf8");
    return true;
  }
  return false;
}

function removeBlockByMarkers(text, startMarker, endMarker, options = {}) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    return text;
  }

  const end = text.indexOf(endMarker, start);
  if (end === -1) {
    if (options.required) {
      throw new Error(`No se encontro endMarker despues de ${startMarker}`);
    }
    return text;
  }

  const endIndex = options.includeEndMarker ? end + endMarker.length : end;
  return text.slice(0, start) + text.slice(endIndex);
}

function patchCreateActions() {
  const path = paths.createActions;
  let text = readFileSync(path, "utf8");

  const createStart = text.indexOf("const credito = await tx.credito.create({");
  if (createStart === -1) {
    throw new Error("No se encontro tx.credito.create en web/src/features/creditos/crear/actions.ts");
  }

  const createEnd = text.indexOf("      });", createStart);
  if (createEnd === -1) {
    throw new Error("No se encontro cierre esperado de tx.credito.create en crear/actions.ts");
  }

  const before = text.slice(0, createStart);
  let block = text.slice(createStart, createEnd + "      });".length);
  const after = text.slice(createEnd + "      });".length);

  if (!block.includes("ownerUserId: user.id,")) {
    if (!block.includes("accionPor: user.id,")) {
      throw new Error("El bloque tx.credito.create no contiene accionPor: user.id, no se parchea a ciegas.");
    }

    block = block.replace(
      "          accionPor: user.id,",
      "          ownerUserId: user.id,\n          accionPor: user.id,",
    );
  }

  text = before + block + after;
  writeIfChanged(path, text);
  console.log("[OK] crear/actions.ts: ownerUserId=user.id asegurado dentro de tx.credito.create.");
}

function patchEditActions() {
  const path = paths.editActions;
  let text = readFileSync(path, "utf8");

  text = text.replace("  adminOverrideCode?: string;\n", "");

  text = removeBlockByMarkers(
    text,
    "function isAdminOverrideAutorizado(",
    "function eventoPuedeRegenerarse(",
    { includeEndMarker: false },
  );

  if (!text.includes("function eventoPuedeRegenerarse(")) {
    throw new Error("Se perdio function eventoPuedeRegenerarse al limpiar edit/actions.ts");
  }

  text = text.replace(
    /\n\s*const adminOverrideAutorizado = isAdminOverrideAutorizado\(\s*input\.adminOverrideCode,\s*\);\n/g,
    "\n",
  );

  text = text.replace(
    "      if (tieneActividad && !adminOverrideAutorizado) {",
    "      if (tieneActividad) {",
  );

  text = text.replace(
    '            accionPor: adminOverrideAutorizado ? "admin_override" : user.id,',
    "            accionPor: user.id,",
  );

  if (text.includes("adminOverride") || text.includes("CREDIT_ADMIN_OVERRIDE_CODE")) {
    throw new Error("editar/actions.ts todavia contiene adminOverride o CREDIT_ADMIN_OVERRIDE_CODE.");
  }

  writeIfChanged(path, text);
  console.log("[OK] editar/actions.ts: override administrativo eliminado del server action.");
}

function removeAdminOverrideUiBlock(text) {
  let next = text;

  next = next.replace('  const [adminOverrideCode, setAdminOverrideCode] = useState("");\n', "");
  next = next.replace("  const [adminOverrideEnabled, setAdminOverrideEnabled] = useState(false);\n", "");
  next = next.replace(
    "  const effectiveCanEditFinancial = canEditFinancial || adminOverrideEnabled;",
    "  const effectiveCanEditFinancial = canEditFinancial;",
  );
  next = next.replace("        adminOverrideCode: adminOverrideEnabled ? adminOverrideCode : undefined,\n", "");

  next = next.replace(
    "              Este crédito ya tiene actividad financiera. Sin autorización\n              administrativa solo se pueden editar notas y observaciones.",
    "              Este crédito ya tiene actividad financiera. Para proteger el\n              historial y el saldo, solo se pueden editar notas y observaciones.",
  );

  // Remove the checkbox label block if present.
  const checkboxNeedle = "Habilitar override administrativo";
  const checkboxPos = next.indexOf(checkboxNeedle);
  if (checkboxPos !== -1) {
    const labelStart = next.lastIndexOf("          <label", checkboxPos);
    const labelEnd = next.indexOf("          </label>", checkboxPos);

    if (labelStart === -1 || labelEnd === -1) {
      throw new Error("No se pudo delimitar el label de override administrativo.");
    }

    next = next.slice(0, labelStart) + next.slice(labelEnd + "          </label>".length);
  }

  // Remove the conditional password input if present.
  const conditionalNeedle = "{adminOverrideEnabled ? (";
  const conditionalPos = next.indexOf(conditionalNeedle);
  if (conditionalPos !== -1) {
    const conditionalStart = next.lastIndexOf("          {adminOverrideEnabled", conditionalPos);
    const conditionalEndNeedle = "          ) : null}";
    const conditionalEnd = next.indexOf(conditionalEndNeedle, conditionalPos);

    if (conditionalStart === -1 || conditionalEnd === -1) {
      throw new Error("No se pudo delimitar el input condicional de override administrativo.");
    }

    next = next.slice(0, conditionalStart) + next.slice(conditionalEnd + conditionalEndNeedle.length);
  }

  return next;
}

function patchEditForm() {
  const path = paths.editForm;
  let text = readFileSync(path, "utf8");
  text = removeAdminOverrideUiBlock(text);

  if (text.includes("adminOverride") || text.includes("Código administrativo") || text.includes("Habilitar override")) {
    throw new Error("credit-edit-form.tsx todavia contiene referencias al override administrativo.");
  }

  writeIfChanged(path, text);
  console.log("[OK] credit-edit-form.tsx: override eliminado de UI y mensaje actualizado.");
}

patchCreateActions();
patchEditActions();
patchEditForm();

console.log("[OK] Patch completo v2.");
