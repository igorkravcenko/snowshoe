import type { ReactElement } from "react";
import { type MetricLevels, TARGET_LAYERS, targetLayerColors, targetTitle } from "./bands.ts";

/**
 * Tree glyph: three color blocks (overview | contracts | internals).
 * Readable at row height; graph keeps the concentric bullseye.
 */
export function MetricTarget(props: { metrics?: MetricLevels; className?: string }): ReactElement {
  const colors = targetLayerColors(props.metrics);
  const title = targetTitle(props.metrics);
  const className = ["metric-bars", props.className].filter(Boolean).join(" ");

  return (
    <span className={className} title={title} aria-hidden>
      {TARGET_LAYERS.map((layer) => (
        <i key={layer} style={{ background: colors[layer] }} data-layer={layer} />
      ))}
    </span>
  );
}
