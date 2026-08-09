import { getGroupBounds } from "../../../lib/editor/geometry";
import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../editor-canvas/ElementsRenderer";

// ─── Group panel (B10) ───────────────────────────────────────────────────────

/** Combined-bounds readout for a selected group (groups have no elementProperties). */
function GroupBoundsPanel({
  groupId,
  layers,
  allElementProperties,
}: {
  groupId: string;
  layers: LayerType[];
  allElementProperties: Record<string, ElementProperties>;
}) {
  const bounds = getGroupBounds(layers, allElementProperties, groupId);
  if (!bounds) return null;
  const childCount = layers.filter((l) => l.parentId === groupId).length;
  return (
    <div className="p-5 border-b border-white/5">
      <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
        Group Bounds
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5">
          <span className="text-zinc-500 text-xs font-mono">X</span>
          <span className="text-sm text-zinc-300 font-mono">
            {Math.round(bounds.x)}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5">
          <span className="text-zinc-500 text-xs font-mono">Y</span>
          <span className="text-sm text-zinc-300 font-mono">
            {Math.round(bounds.y)}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5">
          <span className="text-zinc-500 text-xs font-mono">W</span>
          <span className="text-sm text-zinc-300 font-mono">
            {Math.round(bounds.width)}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5">
          <span className="text-zinc-500 text-xs font-mono">H</span>
          <span className="text-sm text-zinc-300 font-mono">
            {Math.round(bounds.height)}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 mt-2">
        Combined bounds of {childCount} child layer{childCount !== 1 ? "s" : ""}.
        Use the canvas to reposition individual children.
      </p>
    </div>
  );
}

export default GroupBoundsPanel;
