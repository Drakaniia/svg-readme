import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  FlipHorizontal,
  FlipVertical,
  Move,
  Eye,
  FolderOpen,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  MoveHorizontal,
  WrapText,
  Lock,
  Type as TypeIcon,
  Square as SquareIcon,
  Image as ImageIcon,
  Slash as LineIcon,
} from "lucide-react";
import type { ElementProperties } from "../../editor-canvas/ElementsRenderer";
import { isGradient, GRADIENT_PRESETS } from "../../../lib/editor/gradient";
import ColorPickerPopover from "../ColorPickerPopover";
import { useEditor } from "../../../context/EditorContext";
import { PropInput } from "./helpers";
import AlignmentControls from "./AlignmentControls";
import MultiEditControls from "./MultiEditControls";
import GroupBoundsPanel from "./GroupBoundsPanel";
import GradientEditor from "./GradientEditor";

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
            <Move className="w-4 h-4 text-zinc-400" />
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
      default: return <Move className="w-4 h-4 text-zinc-400" />;
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

        {/* Typography */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Typography
          </div>

          <div className="relative mb-3">
            <select
              value={selectedProps.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="Inter">Inter</option>
              <option value="Poppins">Poppins</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Roboto">Roboto</option>
              <option value="Outfit">Outfit</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <select
                value={String(selectedProps.fontWeight)}
                onChange={(e) =>
                  update({ fontWeight: Number(e.target.value) })
                }
                className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">SemiBold</option>
                <option value="700">Bold</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <PropInput
              label="Sz"
              value={String(selectedProps.fontSize)}
              type="number"
              onChange={(v) => {
                const parsed = Number(v);
                if (!isNaN(parsed) && parsed > 0)
                  update({ fontSize: parsed });
              }}
            />
          </div>

          {/* Text Alignment — horizontal (open-pencil: LEFT/CENTER/RIGHT/JUSTIFIED) */}
          <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
            {(["left", "center", "right", "justify"] as const).map((align) => (
              <button
                key={align}
                onClick={() => update({ textAlign: align })}
                title={`Align ${align}`}
                className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
                  selectedProps.textAlign === align
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {align === "left" && <AlignLeft className="w-4 h-4" />}
                {align === "center" && <AlignCenter className="w-4 h-4" />}
                {align === "right" && <AlignRight className="w-4 h-4" />}
                {align === "justify" && <AlignJustify className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* Vertical alignment (open-pencil: TOP/CENTER/BOTTOM) */}
          <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
            {(["top", "center", "bottom"] as const).map((align) => (
              <button
                key={align}
                onClick={() => update({ textAlignVertical: align })}
                title={`Align vertical ${align}`}
                className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
                  (selectedProps.textAlignVertical ?? "top") === align
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {align === "top" && (
                  <AlignVerticalJustifyStart className="w-4 h-4" />
                )}
                {align === "center" && (
                  <AlignVerticalJustifyCenter className="w-4 h-4" />
                )}
                {align === "bottom" && (
                  <AlignVerticalJustifyEnd className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>

          {/* Resizing (open-pencil: AUTO_WIDTH / AUTO_HEIGHT / FIXED) */}
          <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
            {(
              [
                { value: "WIDTH_AND_HEIGHT", label: "Auto W", title: "Auto width & height" },
                { value: "HEIGHT", label: "Auto H", title: "Auto height, fixed width" },
                { value: "NONE", label: "Fixed", title: "Fixed size" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.value}
                onClick={() => update({ textAutoResize: mode.value })}
                title={mode.title}
                className={`flex-1 p-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
                  (selectedProps.textAutoResize ?? "NONE") === mode.value
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {mode.value === "WIDTH_AND_HEIGHT" && (
                  <MoveHorizontal className="w-3.5 h-3.5" />
                )}
                {mode.value === "HEIGHT" && <WrapText className="w-3.5 h-3.5" />}
                {mode.value === "NONE" && <Lock className="w-3.5 h-3.5" />}
                <span className="text-[9px] font-medium">{mode.label}</span>
              </button>
            ))}
          </div>

          {/* Line height + Letter spacing (open-pencil typography fields) */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PropInput
              label="LH"
              value={String(
                Math.round(selectedProps.lineHeight ?? selectedProps.fontSize * 1.4),
              )}
              type="number"
              onChange={(v) => {
                const parsed = Number(v);
                if (!isNaN(parsed) && parsed > 0)
                  update({ lineHeight: parsed });
              }}
            />
            <PropInput
              label="LS"
              value={String(selectedProps.letterSpacing ?? 0)}
              type="number"
              onChange={(v) => {
                const parsed = Number(v);
                if (!isNaN(parsed)) update({ letterSpacing: parsed });
              }}
            />
          </div>

          {/* Formatting toolbar (open-pencil: bold / italic / underline / strikethrough) */}
          <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
            <button
              onClick={() =>
                update({ fontWeight: selectedProps.fontWeight === 700 ? 400 : 700 })
              }
              title="Bold"
              className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${
                selectedProps.fontWeight === 700
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => update({ italic: !selectedProps.italic })}
              title="Italic"
              className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${
                selectedProps.italic
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                update({
                  textDecoration:
                    selectedProps.textDecoration === "UNDERLINE" ? "NONE" : "UNDERLINE",
                })
              }
              title="Underline"
              className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${
                selectedProps.textDecoration === "UNDERLINE"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                update({
                  textDecoration:
                    selectedProps.textDecoration === "STRIKETHROUGH" ? "NONE" : "STRIKETHROUGH",
                })
              }
              title="Strikethrough"
              className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${
                selectedProps.textDecoration === "STRIKETHROUGH"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Strikethrough className="w-4 h-4" />
            </button>
          </div>

          {/* Text case (open-pencil: ORIGINAL / UPPER / LOWER / TITLE) */}
          <div className="mt-2">
            <select
              value={selectedProps.textCase ?? "ORIGINAL"}
              onChange={(e) =>
                update({
                  textCase: e.target
                    .value as "ORIGINAL" | "UPPER" | "LOWER" | "TITLE",
                })
              }
              className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-xs text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="ORIGINAL">Original</option>
              <option value="UPPER">UPPERCASE</option>
              <option value="LOWER">lowercase</option>
              <option value="TITLE">Title Case</option>
            </select>
          </div>
        </div>

        {/* Text Color (ColorPickerPopover) */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Text Color
          </div>
          <ColorPickerPopover
            value={selectedProps.color}
            onChange={(hex) => update({ color: hex })}
          />
        </div>

        {/* Background Fill */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
              Background Fill
            </div>
            {selectedProps.backgroundColor && (
              <button
                onClick={() => update({ backgroundColor: undefined })}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-wider transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          {selectedProps.backgroundColor ? (
            <ColorPickerPopover
              value={selectedProps.backgroundColor}
              onChange={(hex) => update({ backgroundColor: hex })}
            />
          ) : (
            <button
              onClick={() => update({ backgroundColor: "#333333" })}
              className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 border border-dashed border-white/10 hover:border-white/20 rounded-md transition-colors font-medium"
            >
              + Add background fill
            </button>
          )}
        </div>

        <AlignmentControls
          ids={allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? []}
          allElementProperties={allElementProperties ?? {}}
          onMoveElement={onMoveElement ?? (() => undefined)}
          onAlignmentStart={onAlignmentStart}
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

        {/* Appearance — corner radius for rect shapes (after transform, matching Open Pencil ordering) */}
        {selectedProps.kind === "rect" && (
          <div className="p-5 border-b border-white/5">
            <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
              Appearance
            </div>
            <PropInput
              label="Rd"
              value={String(selectedProps.cornerRadius ?? 8)}
              type="number"
              onFocus={onPropertiesStart}
              onChange={(v) => {
                const parsed = Number(v);
                if (!isNaN(parsed) && parsed >= 0)
                  update({ cornerRadius: parsed });
              }}
            />
          </div>
        )}

        <AlignmentControls
          ids={allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? []}
          allElementProperties={allElementProperties ?? {}}
          onMoveElement={onMoveElement ?? (() => undefined)}
          onAlignmentStart={onAlignmentStart}
          frameBounds={frameBounds}
        />

        {/* Fill */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
              Fill
            </div>
            {isGradient(selectedProps.fill) && (
              <button
                onClick={() => update({ fill: "#8b5cf6" })}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-wider transition-colors"
              >
                Solid
              </button>
            )}
          </div>
          {isGradient(selectedProps.fill) ? (
            <GradientEditor
              gradient={selectedProps.fill}
              onChange={(g) => update({ fill: g as unknown as string })}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={selectedProps.fill as string}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={selectedProps.fill as string}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <span className="text-[9px] text-zinc-500 font-mono block mb-2">Gradient Presets</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {GRADIENT_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => update({ fill: preset.gradient as unknown as string })}
                      className="h-8 rounded border border-white/5 hover:border-white/20 transition-colors text-[9px] text-zinc-400 hover:text-zinc-200 flex items-center justify-center overflow-hidden"
                      style={{
                        background:
                          preset.gradient.type === "linear"
                            ? `linear-gradient(${preset.gradient.angle}deg, ${preset.gradient.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})`
                            : `radial-gradient(circle at ${preset.gradient.cx * 100}% ${preset.gradient.cy * 100}%, ${preset.gradient.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})`,
                      }}
                      title={preset.name}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stroke */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Stroke
          </div>
          <div className="flex items-center gap-3 mb-2">
            <input
              type="color"
              value={selectedProps.stroke || "#ffffff"}
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

          {/* Stroke dash pattern — Open Pencil style */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                const hasDash = !!(selectedProps.strokeDashArray);
                update({ strokeDashArray: hasDash ? undefined : "6 3" });
              }}
              title={selectedProps.strokeDashArray ? "Remove dash" : "Add dash pattern"}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                selectedProps.strokeDashArray
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-white/5"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="8" x2="6" y2="8" /><line x1="9" y1="8" x2="13" y2="8" />
              </svg>
              <span>Dash</span>
            </button>
            {selectedProps.strokeDashArray && (
              <>
                <PropInput
                  label="D"
                  value={String(selectedProps.strokeDashArray?.split(" ")[0] ?? "6")}
                  type="number"
                  onFocus={onPropertiesStart}
                  onChange={(v) => {
                    const parts = (selectedProps.strokeDashArray ?? "6 3").split(" ");
                    const parsed = Number(v);
                    if (!isNaN(parsed) && parsed >= 1) {
                      parts[0] = String(parsed);
                      update({ strokeDashArray: parts.join(" ") });
                    }
                  }}
                />
                <PropInput
                  label="G"
                  value={String(selectedProps.strokeDashArray?.split(" ")[1] ?? "3")}
                  type="number"
                  onFocus={onPropertiesStart}
                  onChange={(v) => {
                    const parts = (selectedProps.strokeDashArray ?? "6 3").split(" ");
                    const parsed = Number(v);
                    if (!isNaN(parsed) && parsed >= 1) {
                      parts[1] = String(parsed);
                      update({ strokeDashArray: parts.join(" ") });
                    }
                  }}
                />
              </>
            )}
          </div>

          {/* Stroke cap / join */}
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <span className="text-[9px] text-zinc-500 font-mono block mb-1">Cap</span>
              <select
                value={selectedProps.strokeLinecap ?? "butt"}
                onChange={(e) => {
                  onPropertiesStart?.();
                  update({ strokeLinecap: e.target.value as "butt" | "round" | "square" });
                }}
                className="w-full bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
              >
                <option value="butt">Butt</option>
                <option value="round">Round</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div className="flex-1">
              <span className="text-[9px] text-zinc-500 font-mono block mb-1">Join</span>
              <select
                value={selectedProps.strokeLinejoin ?? "miter"}
                onChange={(e) => {
                  onPropertiesStart?.();
                  update({ strokeLinejoin: e.target.value as "miter" | "round" | "bevel" });
                }}
                className="w-full bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50"
              >
                <option value="miter">Miter</option>
                <option value="round">Round</option>
                <option value="bevel">Bevel</option>
              </select>
            </div>
          </div>
        </div>
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
