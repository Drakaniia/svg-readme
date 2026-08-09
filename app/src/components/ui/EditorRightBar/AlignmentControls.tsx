import { useState } from "react";
import type { ElementProperties } from "../../editor-canvas/ElementsRenderer";
import { AlignBtn, AlignLeftIcon, AlignCenterHIcon, AlignRightIcon, AlignTopIcon, AlignMiddleIcon, AlignBottomIcon, DistributeHIcon, DistributeVIcon } from "./AlignmentIcons";
import { applyAlignment, applyDistributeSpacing, type AlignmentAction } from "./helpers";

// ─── Alignment UI Components ─────────────────────────────────────────────────

function AlignmentControls({
  ids,
  allElementProperties,
  onMoveElement,
  onAlignmentStart,
  frameBounds,
}: {
  ids: string[];
  allElementProperties: Record<string, ElementProperties>;
  onMoveElement: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  /** When provided, a single-layer selection aligns against the frame instead. */
  frameBounds?: { x: number; y: number; width: number; height: number } | null;
}) {
  const hasMultipleSelection = ids.length >= 2;
  const hasSingleWithFrame = ids.length === 1 && !!frameBounds;
  // Align buttons are available with 2+ layers (selection-relative) or with a
  // single layer when aligning to the frame (B7).
  const canAlign = hasMultipleSelection || hasSingleWithFrame;
  const hasThreeOrMore = ids.length >= 3;
  const [spacingGap, setSpacingGap] = useState("0");

  const align = (action: AlignmentAction) => {
    onAlignmentStart?.();
    applyAlignment(action, ids, allElementProperties, onMoveElement, frameBounds);
  };
  const applySpacing = (direction: "horizontal" | "vertical") => {
    const gap = Number(spacingGap) || 0;
    onAlignmentStart?.();
    applyDistributeSpacing(ids, allElementProperties, direction, gap, onMoveElement);
  };

  const alignHint = hasSingleWithFrame
    ? "Single layer — aligns to the canvas frame"
    : undefined;

  return (
    <div className="p-5 border-b border-white/5">
      <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Align Objects</div>
      {alignHint && (
        <p className="text-[10px] text-zinc-600 mb-2">{alignHint}</p>
      )}
      <div className="flex flex-col gap-2 mt-2">
        <div className="grid grid-cols-3 gap-1.5">
          <AlignBtn onClick={() => align("left")} disabled={!canAlign} label="Left"><AlignLeftIcon /></AlignBtn>
          <AlignBtn onClick={() => align("centerH")} disabled={!canAlign} label="Center"><AlignCenterHIcon /></AlignBtn>
          <AlignBtn onClick={() => align("right")} disabled={!canAlign} label="Right"><AlignRightIcon /></AlignBtn>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <AlignBtn onClick={() => align("top")} disabled={!canAlign} label="Top"><AlignTopIcon /></AlignBtn>
          <AlignBtn onClick={() => align("centerV")} disabled={!canAlign} label="Middle"><AlignMiddleIcon /></AlignBtn>
          <AlignBtn onClick={() => align("bottom")} disabled={!canAlign} label="Bottom"><AlignBottomIcon /></AlignBtn>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-1.5">
          <AlignBtn onClick={() => align("distributeH")} disabled={!hasThreeOrMore} label="Distribute H"><DistributeHIcon /></AlignBtn>
          <AlignBtn onClick={() => align("distributeV")} disabled={!hasThreeOrMore} label="Distribute V"><DistributeVIcon /></AlignBtn>
        </div>

        {/* Distribute with exact spacing (B7) */}
        {hasThreeOrMore && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Spacing</span>
              <input
                type="number"
                value={spacingGap}
                min={0}
                onChange={(e) => setSpacingGap(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
                aria-label="Exact spacing between layers"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => applySpacing("horizontal")}
                  title="Distribute horizontally with this exact gap"
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                >
                  <DistributeHIcon />
                </button>
                <button
                  onClick={() => applySpacing("vertical")}
                  title="Distribute vertically with this exact gap"
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                >
                  <DistributeVIcon />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlignmentControls;
