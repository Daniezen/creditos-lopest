"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { extenderPlazoSoloInteres, reversarExtensionPlazo } from "./actions";
import { initialExtensionTermState } from "./extension-state";

export function ExtensionTermForm({ creditoId, reversibleSnapshotId }: { creditoId: string; reversibleSnapshotId: string | null }) {
  const router = useRouter();
  const [extendState, extendAction, extending] = useActionState(extenderPlazoSoloInteres, initialExtensionTermState);
  const [reverseState, reverseAction, reversing] = useActionState(reversarExtensionPlazo, initialExtensionTermState);
  useEffect(() => { if (extendState.ok || reverseState.ok) router.refresh(); }, [extendState.ok, reverseState.ok, router]);
  const feedback = reverseState.message ?? extendState.message;
  const success = reverseState.message ? reverseState.ok : extendState.ok;
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto">
      <form action={extendAction} className="flex w-full flex-col gap-2 sm:min-w-80 sm:flex-row sm:items-end">
        <input type="hidden" name="creditoId" value={creditoId} />
        <label className="min-w-0 flex-1"><span className={formRecipes.label}>Cuotas extra</span><input name="cuotasExtra" inputMode="numeric" placeholder="Ej: 2" required disabled={extending || Boolean(reversibleSnapshotId)} className={formRecipes.control} /></label>
        <button type="submit" disabled={extending || Boolean(reversibleSnapshotId)} className={actionRecipes.secondary}>{extending ? "Extendiendo..." : "Extender"}</button>
      </form>
      {reversibleSnapshotId ? (
        <form action={reverseAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="creditoId" value={creditoId} /><input type="hidden" name="snapshotId" value={reversibleSnapshotId} />
          <label className="min-w-0 flex-1"><span className={formRecipes.label}>Motivo de reversión (opcional)</span><input name="motivo" maxLength={500} disabled={reversing} className={formRecipes.control} /></label>
          <button type="submit" disabled={reversing} className={actionRecipes.destructive}>{reversing ? "Revirtiendo..." : "Revertir última extensión"}</button>
        </form>
      ) : null}
      {feedback ? <p role="status" className={success ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{feedback}</p> : null}
    </div>
  );
}
