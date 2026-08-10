import { FlipHorizontal, FlipVertical } from "lucide-react";
import type { ElementProperties } from "../../editor-canvas/ElementsRenderer";

// ─── Multi-edit (B10) ────────────────────────────────────────────────────────

/**
 * Bulk property editing for multi-selections (B10): every control updates ALL
 * selected layers at once through onBulkUpdateProperties. Controls appear based
 * on the union of editable fields across the selection.
 */
function MultiEditControls({
  ids,
  allElementProperties,
  onBulkUpdateProperties,
  onPropertiesStart,
}: {
  ids: string[];
  allElementProperties: Record<string, ElementProperties>;
  onBulkUpdateProperties?: (updates: Partial<ElementProperties>) => void;
  onPropertiesStart?: () => void;
}) {
  const propsList = ids
    .map((id) => allElementProperties[id])
    .filter((p): p is ElementProperties => !!p);
  if (propsList.length === 0 || !onBulkUpdateProperties) return null;

  const hasOpacity = propsList.some((p) => p.type !== "text");
  const hasFill = propsList.some(
    (p) => p.type === "shape" || p.type === "path" || p.type === "text",
  );
  const hasStroke = propsList.some(
    (p) => p.type === "shape" || p.type === "path",
  );
  const hasFlip = propsList.some(
    (p) => p.type === "shape" || p.type === "image",
  );
  const allText = propsList.every((p) => p.type === "text");

  // Aggregate: return the shared value when every selected layer agrees,
  // otherwise undefined (shown as a "—" mixed placeholder).
  const common = <T,>(pick: (p: ElementProperties) => T | undefined): T | undefined => {
    const first = pick(propsList[0]);
    return propsList.every((p) => pick(p) === first) ? first : undefined;
  };

  const opacity = common((p) =>
    p.type === "text" ? undefined : (p.opacity as number | undefined),
  );
  const fill = common((p) => {
    if (p.type === "shape" || p.type === "path") return p.fill as string;
    if (p.type === "text") return p.color;
    return undefined;
  });
  const stroke = common((p) =>
    p.type === "shape" || p.type === "path" ? (p.stroke as string) : undefined,
  );
  const strokeWidth = common((p) =>
    p.type === "shape" || p.type === "path" ? p.strokeWidth : undefined,
  );
  const fontSize = common((p) =>
    p.type === "text" ? p.fontSize : undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      {hasOpacity && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider w-14 shrink-0">
            Opacity
          </span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={opacity === undefined ? "" : String(opacity)}
            placeholder="—"
            onFocus={onPropertiesStart}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (!isNaN(parsed))
                onBulkUpdateProperties({
                  opacity: Math.max(0, Math.min(1, parsed)),
                } as Partial<ElementProperties>);
            }}
            className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
            aria-label="Bulk opacity"
          />
        </div>
      )}

      {hasFill && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider">
            Fill / Text color
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fill ?? "#8b5cf6"}
              onFocus={onPropertiesStart}
              onChange={(e) =>
                onBulkUpdateProperties({ fill: e.target.value } as Partial<ElementProperties>)
              }
              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent shrink-0"
              aria-label="Bulk fill color"
            />
            <input
              type="text"
              value={fill ?? ""}
              placeholder="—"
              onFocus={onPropertiesStart}
              onChange={(e) =>
                onBulkUpdateProperties({ fill: e.target.value } as Partial<ElementProperties>)
              }
              className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
              aria-label="Bulk fill hex"
            />
          </div>
        </div>
      )}

      {hasStroke && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider">
            Stroke
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={stroke ?? "#ffffff"}
              onFocus={onPropertiesStart}
              onChange={(e) =>
                onBulkUpdateProperties({ stroke: e.target.value } as Partial<ElementProperties>)
              }
              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent shrink-0"
              aria-label="Bulk stroke color"
            />
            <input
              type="text"
              value={stroke ?? ""}
              placeholder="—"
              onFocus={onPropertiesStart}
              onChange={(e) =>
                onBulkUpdateProperties({ stroke: e.target.value } as Partial<ElementProperties>)
              }
              className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
              aria-label="Bulk stroke hex"
            />
            <input
              type="number"
              min={0}
              value={strokeWidth === undefined ? "" : String(strokeWidth)}
              placeholder="—"
              onFocus={onPropertiesStart}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                if (!isNaN(parsed) && parsed >= 0)
                  onBulkUpdateProperties({ strokeWidth: parsed } as Partial<ElementProperties>);
              }}
              className="w-16 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
              aria-label="Bulk stroke width"
            />
          </div>
        </div>
      )}

      {allText && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider w-14 shrink-0">
            Font size
          </span>
          <input
            type="number"
            min={1}
            value={fontSize === undefined ? "" : String(fontSize)}
            placeholder="—"
            onFocus={onPropertiesStart}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (!isNaN(parsed) && parsed > 0)
                onBulkUpdateProperties({ fontSize: parsed } as Partial<ElementProperties>);
            }}
            className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-md px-2.5 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
            aria-label="Bulk font size"
          />
        </div>
      )}

      {hasFlip && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 font-mono mr-1">Flip</span>
          <button
            onClick={() =>
              onBulkUpdateProperties({ flipH: true } as Partial<ElementProperties>)
            }
            className="p-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            title="Flip Horizontal (all selected)"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              onBulkUpdateProperties({ flipV: true } as Partial<ElementProperties>)
            }
            className="p-1.5 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            title="Flip Vertical (all selected)"
          >
            <FlipVertical className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default MultiEditControls;
