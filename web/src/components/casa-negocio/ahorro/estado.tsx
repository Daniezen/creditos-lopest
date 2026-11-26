import Link from "next/link";

import { cnEstadoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";

/**
 * Empty, error and no-access states of the Ahorro and Arqueo tabs: a white
 * card on the paper sheet with a title, one line, and at most one way out.
 */
export function EstadoTab({
  titulo,
  texto,
  accion,
  role,
}: {
  titulo: string;
  texto: string;
  accion?: { label: string; href: string };
  /** `alert` for errors, so assistive technology announces them. */
  role?: "alert" | "status";
}) {
  return (
    <section className={cnEstadoRecipes.box} role={role} aria-labelledby="estado-tab-titulo">
      <h2 id="estado-tab-titulo" className={cnEstadoRecipes.title}>
        {titulo}
      </h2>
      <p className={cnEstadoRecipes.text}>{texto}</p>
      {accion ? (
        <Link href={accion.href} className={cnEstadoRecipes.action}>
          {accion.label}
        </Link>
      ) : null}
    </section>
  );
}

/** Loading placeholder with the footprint of the tab's content. */
export function CargandoTab({ etiqueta, forma }: { etiqueta: string; forma: "ahorro" | "arqueo" }) {
  return (
    <div role="status" aria-live="polite" className="contents">
      <span className="sr-only">{etiqueta}</span>
      <div className={cnEstadoRecipes.skeletonRow} aria-hidden="true">
        <div className={cnEstadoRecipes.skeleton} />
        <div className={cnEstadoRecipes.skeleton} />
        {forma === "arqueo" ? <div className={cnEstadoRecipes.skeleton} /> : null}
      </div>
      <div className={cnEstadoRecipes.skeletonWide} aria-hidden="true" />
    </div>
  );
}
