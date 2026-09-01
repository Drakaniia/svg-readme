import {
  FlipHorizontal,
  FlipVertical,
  ArrowsOutCardinal,
  Eye,
  FolderOpen,
  TextT as TypeIcon,
  Square as SquareIcon,
  Image as ImageIcon,
  LineSegment as LineIcon,
} from "@phosphor-icons/react";
import type { ElementProperties } from "../../editor-canvas/ElementsRenderer";
import { useEditor } from "../../../context/EditorContext";
import { PropInput } from "./helpers";
import AlignmentControls from "./AlignmentControls";
import MultiEditControls from "./MultiEditControls";
import GroupBoundsPanel from "./GroupBoundsPanel";
import { DesignTabText } from "./DesignTabText";
import { DesignTabShape } from "./DesignTabShape";

// ─── Design Tab ───────────────────────────────────────────────────────────────

interface DesignTabProps {
  selectedId: string | null;
  selectedProps: ElementProperties | null;
  onUpdateProperties?: (id: string, updates: Partial<ElementProperties>) => void;
  onBulkUpdateProperties?: (updates: Partial<ElementProperties>) => void;
  onPropertiesStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  multiSelectCount: number;
  allElementProperties?: Record<string, ElementProperties>;
  allSelectedLayerIds?: string[];
  /** Canvas size — used to align a single layer to the frame (B7). */
  frameSize?: { width: number; height: number };
}

function DesignTab({
  selectedId,
  selectedProps,
  onUpdateProperties,
  onBulkUpdateProperties,
  onPropertiesStart,
  onMoveElement,
  onAlignmentStart,
  multiSelectCount,
  allElementProperties,
  allSelectedLayerIds,
  frameSize,
}: DesignTabProps) {
  const { layers } = useEditor();

  // Shared alignment target: the frame when a single layer is selected (so it
  // can be aligned to the canvas), or null for multi-selection (selection-relative).
  const frameBounds = frameSize
    ? { x: 0, y: 0, width: frameSize.width, height: frameSize.height }
    : null;

  if (multiSelectCount > 1) {
    const ids = allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? [];
    return (
      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
            <ArrowsOutCardinal className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300">Multiple Selection</h3>
            <p className="text-xs text-zinc-500">{multiSelectCount} layers selected</p>
          </div>
        </div>
        <MultiEditControls
          ids={ids}
          allElementProperties={allElementProperties ?? {}}
          onBulkUpdateProperties={onBulkUpdateProperties}
          onPropertiesStart={onPropertiesStart}
        />
        {allElementProperties && onMoveElement && (
          <AlignmentControls
            ids={ids}
            allElementProperties={allElementProperties}
            onMoveElement={onMoveElement}
            onAlignmentStart={onAlignmentStart}
          />
        )}
      </div>
    );
  }

  if (!selectedId || !selectedProps) {
    // Check if a group is selected (groups have no elementProperties)
    const selectedLayer = layers?.find((l) => l.id === selectedId);
    if (selectedLayer && selectedLayer.type === "group") {
      const childCount = layers?.filter((l) => l.parentId === selectedLayer.id).length ?? 0;
      const groupIds = allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? [];
      return (
        <div className="p-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{selectedLayer.name}</h3>
              <p className="text-xs text-zinc-500">
                Group · {childCount} child{childCount !== 1 ? "ren" : ""}
              </p>
            </div>
          </div>
          {allElementProperties && (
            <GroupBoundsPanel
              groupId={selectedLayer.id}
              layers={layers ?? []}
              allElementProperties={allElementProperties}
            />
          )}
          {allElementProperties && onMoveElement && (
            <AlignmentControls
              ids={groupIds}
              allElementProperties={allElementProperties}
              onMoveElement={onMoveElement}
              onAlignmentStart={onAlignmentStart}
              frameBounds={frameBounds}
            />
          )}
        </div>
      );
    }

    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
          <Eye className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-1">
            No Selection
          </h3>
          <p className="text-xs text-zinc-500">
            Select a layer on the canvas to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  const update = (updates: Partial<ElementProperties>) =>
    onUpdateProperties?.(selectedId, updates);

  const selectedLayer = layers?.find((l) => l.id === selectedId);

  // ── Selection header: layer type icon + name + type badge (B10) ────────
  const layerIcon = () => {
    switch (selectedLayer?.type) {
      case "text": return <TypeIcon className="w-4 h-4 text-zinc-400" />;
      case "image": return <ImageIcon className="w-4 h-4 text-zinc-400" />;
      case "group": return <FolderOpen className="w-4 h-4 text-zinc-400" />;
      case "shape": return selectedProps.type === "path"
        ? <LineIcon className="w-4 h-4 text-zinc-400" />
        : <SquareIcon className="w-4 h-4 text-zinc-400" />;
      default: return <ArrowsOutCardinal className="w-4 h-4 text-zinc-400" />;
    }
  };
  const typeLabel = selectedProps.type === "path"
    ? "Path"
    : (selectedLayer?.type ?? selectedProps.type);
  const selectionHeader = (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/5">
      <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0">
        {layerIcon()}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-zinc-200 truncate">
          {selectedLayer?.name ?? "Layer"}
        </h3>
        <p className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider">
          {typeLabel}
        </p>
      </div>
    </div>
  );

  // ── Common Layout Section (all types have x, y, width, height) ────────
  const layoutSection = (
    <div className="p-5 border-b border-white/5">
      <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
        Layout
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <PropInput
          label="X"
          value={String(Math.round(selectedProps.x))}
          type="number"
          onFocus={onPropertiesStart}
          onChange={(v) => update({ x: Number(v) || 0 })}
        />
        <PropInput
          label="Y"
          value={String(Math.round(selectedProps.y))}
          type="number"
          onFocus={onPropertiesStart}
          onChange={(v) => update({ y: Number(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropInput
          label="W"
          value={String(
            typeof selectedProps.width === "number"
              ? Math.round(selectedProps.width)
              : selectedProps.width,
          )}
          type={typeof selectedProps.width === "number" ? "number" : "text"}
          onFocus={onPropertiesStart}
          onChange={(v) => {
            const parsed = Number(v);
            if (!isNaN(parsed) && parsed > 0)
              update({ width: parsed } as Partial<ElementProperties>);
          }}
        />
        <PropInput
          label="H"
          value={String(Math.round(selectedProps.height))}
          type="number"
          onFocus={onPropertiesStart}
          onChange={(v) => {
            const parsed = Number(v);
            if (!isNaN(parsed) && parsed > 0) update({ height: parsed });
          }}
        />
      </div>
    </div>
  );

  // ── Rotation / Opacity Section (shapes & images) ──────────────────────
  const transformSection =
    selectedProps.type === "shape" || selectedProps.type === "image" || selectedProps.type === "path" ? (
      <div className="p-5 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Transform
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PropInput
            label="R°"
            value={String(Math.round(selectedProps.rotation ?? 0))}
            type="number"
            onFocus={onPropertiesStart}
            onChange={(v) => update({ rotation: Number(v) || 0 })}
          />
          <PropInput
            label="Op"
            value={String(selectedProps.opacity)}
            type="number"
            onFocus={onPropertiesStart}
            onChange={(v) => {
              const parsed = Number(v);
              if (!isNaN(parsed))
                update({ opacity: Math.max(0, Math.min(1, parsed)) });
            }}
          />
        </div>
        {/* Flip controls */}
        {(selectedProps.type === "shape" || selectedProps.type === "image") && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] text-zinc-500 font-mono mr-1">Flip</span>
            <button
              onClick={() => update({ flipH: !selectedProps.flipH })}
              className={`p-1.5 rounded text-xs transition-colors ${
                selectedProps.flipH
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => update({ flipV: !selectedProps.flipV })}
              className={`p-1.5 rounded text-xs transition-colors ${
                selectedProps.flipV
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
              title="Flip Vertical"
            >
              <FlipVertical className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    ) : null;

  // ── Type-specific sections ────────────────────────────────────────────
  if (selectedProps.type === "text") {
    return (
      <>
        {selectionHeader}
        {layoutSection}
        <DesignTabText
          selectedProps={selectedProps}
          update={update}
          onPropertiesStart={onPropertiesStart}
          onMoveElement={onMoveElement}
          onAlignmentStart={onAlignmentStart}
          allElementProperties={allElementProperties}
          allSelectedLayerIds={allSelectedLayerIds}
          frameBounds={frameBounds}
        />
      </>
    );
  }

  if (selectedProps.type === "shape") {
    return (
      <>
        {selectionHeader}
        {layoutSection}
        {transformSection}
        <DesignTabShape
          selectedProps={selectedProps}
          update={update}
          onPropertiesStart={onPropertiesStart}
          onMoveElement={onMoveElement}
          onAlignmentStart={onAlignmentStart}
          allElementProperties={allElementProperties}
          allSelectedLayerIds={allSelectedLayerIds}
          frameBounds={frameBounds}
        />
      </>
    );
  }

  if (selectedProps.type === "image") {
    return (
      <>
        {selectionHeader}
        {layoutSection}
        {transformSection}
        <AlignmentControls
          ids={allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? []}
          allElementProperties={allElementProperties ?? {}}
          onMoveElement={onMoveElement ?? (() => undefined)}
          onAlignmentStart={onAlignmentStart}
          frameBounds={frameBounds}
        />
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">Image</div>
          <p className="text-xs text-zinc-500 leading-relaxed">Image content is embedded in the exported SVG.</p>
        </div>
      </>
    );
  }

  if (selectedProps.type === "path") {
    return (
      <>
        {selectionHeader}
        {layoutSection}
        {transformSection}
        <AlignmentControls
          ids={allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? []}
          allElementProperties={allElementProperties ?? {}}
          onMoveElement={onMoveElement ?? (() => undefined)}
          onAlignmentStart={onAlignmentStart}
          frameBounds={frameBounds}
        />

        {/* Stroke */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Stroke
          </div>
          <div className="flex items-center gap-3 mb-2">
            <input
              type="color"
              value={selectedProps.stroke || "#3b82f6"}
              onChange={(e) => update({ stroke: e.target.value })}
              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={selectedProps.stroke}
              onChange={(e) => update({ stroke: e.target.value })}
              className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500/50 transition-all font-mono"
            />
          </div>
          <PropInput
            label="Wt"
            value={String(selectedProps.strokeWidth)}
            type="number"
            onFocus={onPropertiesStart}
            onChange={(v) => {
              const parsed = Number(v);
              if (!isNaN(parsed) && parsed >= 0)
                update({ strokeWidth: parsed });
            }}
          />
        </div>

        {/* Fill */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Fill
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={selectedProps.fill}
              onChange={(e) => update({ fill: e.target.value })}
              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={selectedProps.fill}
              onChange={(e) => update({ fill: e.target.value })}
              className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500/50 transition-all font-mono"
            />
          </div>
        </div>
      </>
    );
  }

  return null;
}

export default DesignTab;
