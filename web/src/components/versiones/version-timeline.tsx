import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { statusRecipes } from "@/design-system/recipes/status";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { versionRecipes } from "@/design-system/recipes/versions";
import { tokenizeInline } from "@/features/versiones/changelog-format";
import { formatVersionDay, type VisibleVersion } from "@/features/versiones/version-visibility";

interface VersionTimelineProps {
  current: string | null;
  nodes: VisibleVersion[];
}

/**
 * Server component: one card per version the reader may see, newest first,
 * with every section already filtered on the server.
 */
export function VersionTimeline({ current, nodes }: VersionTimelineProps) {
  if (nodes.length === 0) {
    return (
      <div className={[surfaceRecipes.section, dataDisplayRecipes.emptyState, "p-10"].join(" ")}>
        <p className="text-sm">Todavía no hay versiones para mostrar.</p>
      </div>
    );
  }

  return (
    <ol className={versionRecipes.timeline}>
      {nodes.map((node) => {
        const isCurrent = node.released && node.version === current;
        const dotState = !node.released
          ? versionRecipes.nodeDotUnreleased
          : isCurrent
            ? versionRecipes.nodeDotCurrent
            : versionRecipes.nodeDotReleased;

        return (
          <li key={node.version ?? "sin-publicar"} className={[surfaceRecipes.section, versionRecipes.node].join(" ")}>
            <header className={versionRecipes.nodeHeader}>
              <span className={[versionRecipes.nodeDot, dotState].join(" ")} aria-hidden />
              <h2 className={versionRecipes.nodeTitle}>{node.version ? `Versión ${node.version}` : "Sin publicar"}</h2>
              {node.date ? <time dateTime={node.date} className={versionRecipes.nodeDate}>{formatVersionDay(node.date)}</time> : null}
              {isCurrent ? <span className={statusRecipes.success}>Vigente</span> : null}
              {!node.released ? <span className={statusRecipes.neutral}>En desarrollo</span> : null}
            </header>

            <div className={versionRecipes.sectionList}>
              {node.sections.map((section) => (
                <section key={section.audience}>
                  <h3 className={versionRecipes.sectionTitle}>{section.audience}</h3>
                  <ul className={versionRecipes.bulletList}>
                    {section.bullets.map((bullet, index) => (
                      <li key={index}>
                        <InlineText text={bullet} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Renders `code` and **bold**; every token is a text node, never HTML. */
function InlineText({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((token, index) => {
        if (token.kind === "code") return <code key={index} className={versionRecipes.inlineCode}>{token.value}</code>;
        if (token.kind === "strong") return <strong key={index} className={versionRecipes.inlineStrong}>{token.value}</strong>;
        return <span key={index}>{token.value}</span>;
      })}
    </>
  );
}
