import { useState, useCallback } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  Eye,
  Download,
  Clipboard,
  Code,
  Image,
  Check,
} from "lucide-react";
import type { ElementProperties, TextElementProperties } from "../editor-canvas/ElementsRenderer";
import { getTextBoundingBox } from "../editor-canvas/ElementsRenderer";
import ColorPickerPopover from "./ColorPickerPopover";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorRightBarProps {
  onExport?: () => void;
  selectedLayerIds?: string[];
  elementProperties?: Record<string, ElementProperties>;
  onUpdateProperties?: (id: string, updates: Partial<ElementProperties>) => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
}

export default function EditorRightBar({
  onExport,
  selectedLayerIds,
  elementProperties,
  onUpdateProperties,
  onMoveElement,
}: EditorRightBarProps) {
  const [activeTab, setActiveTab] = useState<"design" | "animate" | "export">(
    "design",
  );
  const [copiedType, setCopiedType] = useState<"svg" | "markdown" | null>(null);

  const handleCopySvg = async () => {
    window.dispatchEvent(new CustomEvent("copy-svg-code"));
    setCopiedType("svg");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyMarkdown = async () => {
    window.dispatchEvent(new CustomEvent("copy-markdown"));
    setCopiedType("markdown");
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Determine selected element
  const selectedId =
    selectedLayerIds && selectedLayerIds.length === 1
      ? selectedLayerIds[0]
      : null;
  const selectedProps =
    selectedId && elementProperties ? elementProperties[selectedId] : null;

  return (
    <aside className="w-80 shrink-0 border-l border-white/5 bg-[#09090b]/95 backdrop-blur-xl flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.2)]">
      {/* Tab Headers */}
      <div className="flex border-b border-white/5 px-2 pt-2">
        <button
          onClick={() => setActiveTab("design")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "design"
              ? "border-blue-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Design
        </button>
        <button
          onClick={() => setActiveTab("animate")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "animate"
              ? "border-blue-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Animate
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "export"
              ? "border-blue-500 text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent">
        {activeTab === "design" && (
          <DesignTab
            selectedId={selectedId}
            selectedProps={selectedProps}
            onUpdateProperties={onUpdateProperties}
            onMoveElement={onMoveElement}
            multiSelectCount={selectedLayerIds?.length ?? 0}
            allElementProperties={elementProperties}
            allSelectedLayerIds={selectedLayerIds}
          />
        )}
        {activeTab === "animate" && <AnimateTab />}
        {activeTab === "export" && (
          <ExportTab
            onExport={onExport}
            onCopySvg={handleCopySvg}
            onCopyMarkdown={handleCopyMarkdown}
            copiedType={copiedType}
          />
        )}
      </div>
    </aside>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared input field component for the right sidebar */
function PropInput({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
      <span className="text-zinc-500 text-xs font-mono">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm w-full outline-none text-zinc-300 focus:text-white"
      />
    </div>
  );
}

// ─── Design Tab ───────────────────────────────────────────────────────────────

interface DesignTabProps {
  selectedId: string | null;
  selectedProps: ElementProperties | null;
  onUpdateProperties?: (id: string, updates: Partial<ElementProperties>) => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  multiSelectCount: number;
  allElementProperties?: Record<string, ElementProperties>;
  allSelectedLayerIds?: string[];
}

function DesignTab({
  selectedId,
  selectedProps,
  onUpdateProperties,
  onMoveElement,
  multiSelectCount,
  allElementProperties,
  allSelectedLayerIds,
}: DesignTabProps) {
  if (multiSelectCount > 1) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
          <Move className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-1">
            Multiple Selection
          </h3>
          <p className="text-xs text-zinc-500">
            {multiSelectCount} layers selected. Select a single layer to edit
            its properties.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedId || !selectedProps) {
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
          onChange={(v) => update({ x: Number(v) || 0 })}
        />
        <PropInput
          label="Y"
          value={String(Math.round(selectedProps.y))}
          type="number"
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
    selectedProps.type === "shape" || selectedProps.type === "image" ? (
      <div className="p-5 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Transform
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PropInput
            label="R°"
            value={String(Math.round(selectedProps.rotation ?? 0))}
            type="number"
            onChange={(v) => update({ rotation: Number(v) || 0 })}
          />
          <PropInput
            label="Op"
            value={String(selectedProps.opacity)}
            type="number"
            onChange={(v) => {
              const parsed = Number(v);
              if (!isNaN(parsed))
                update({ opacity: Math.max(0, Math.min(1, parsed)) });
            }}
          />
        </div>
      </div>
    ) : null;

  // ── Alignment handler (multi-select) ─────────────────────────────────────
  const hasMultipleSelection = (allSelectedLayerIds?.length ?? 0) >= 2;
  const hasThreeOrMore = (allSelectedLayerIds?.length ?? 0) >= 3;

  const handleAlign = useCallback(
    (alignType: string) => {
      const ids = allSelectedLayerIds?.filter((id) => allElementProperties?.[id]) ?? [];
      if (ids.length < 2 || !onMoveElement) return;

      const bbs = ids.map((id) => ({
        id,
        bb: getTextBoundingBox(allElementProperties![id] as TextElementProperties),
        props: allElementProperties![id],
      }));

      switch (alignType) {
        case "left": {
          const minX = Math.min(...bbs.map((b) => b.bb.x));
          bbs.forEach((b) => onMoveElement(b.id, b.props.x + (minX - b.bb.x), b.props.y));
          break;
        }
        case "centerH": {
          const avgCenter = bbs.reduce((sum, b) => sum + b.bb.x + b.bb.width / 2, 0) / bbs.length;
          bbs.forEach((b) => onMoveElement(b.id, b.props.x + (avgCenter - b.bb.width / 2 - b.bb.x), b.props.y));
          break;
        }
        case "right": {
          const maxRight = Math.max(...bbs.map((b) => b.bb.x + b.bb.width));
          bbs.forEach((b) => onMoveElement(b.id, b.props.x + (maxRight - b.bb.width - b.bb.x), b.props.y));
          break;
        }
        case "top": {
          const minY = Math.min(...bbs.map((b) => b.bb.y));
          bbs.forEach((b) => onMoveElement(b.id, b.props.x, b.props.y + (minY - b.bb.y)));
          break;
        }
        case "centerV": {
          const avgCenter = bbs.reduce((sum, b) => sum + b.bb.y + b.bb.height / 2, 0) / bbs.length;
          bbs.forEach((b) => onMoveElement(b.id, b.props.x, b.props.y + (avgCenter - b.bb.height / 2 - b.bb.y)));
          break;
        }
        case "bottom": {
          const maxBottom = Math.max(...bbs.map((b) => b.bb.y + b.bb.height));
          bbs.forEach((b) => onMoveElement(b.id, b.props.x, b.props.y + (maxBottom - b.bb.height - b.bb.y)));
          break;
        }
        case "distributeH": {
          const sorted = [...bbs].sort((a, b) => a.bb.x - b.bb.x);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalSpan = last.bb.x + last.bb.width - first.bb.x;
          const objectsWidth = sorted.reduce((s, b) => s + b.bb.width, 0);
          const gap = objectsWidth > 0 ? (totalSpan - objectsWidth) / (sorted.length - 1) : totalSpan / (sorted.length - 1);
          let curX = first.bb.x;
          sorted.forEach((b) => { onMoveElement(b.id, b.props.x + (curX - b.bb.x), b.props.y); curX += b.bb.width + gap; });
          break;
        }
        case "distributeV": {
          const sorted = [...bbs].sort((a, b) => a.bb.y - b.bb.y);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const totalSpan = last.bb.y + last.bb.height - first.bb.y;
          const objectsHeight = sorted.reduce((s, b) => s + b.bb.height, 0);
          const gap = objectsHeight > 0 ? (totalSpan - objectsHeight) / (sorted.length - 1) : totalSpan / (sorted.length - 1);
          let curY = first.bb.y;
          sorted.forEach((b) => { onMoveElement(b.id, b.props.x, b.props.y + (curY - b.bb.y)); curY += b.bb.height + gap; });
          break;
        }
      }
    },
    [allSelectedLayerIds, allElementProperties, onMoveElement],
  );

  // ── Type-specific sections ────────────────────────────────────────────
  if (selectedProps.type === "text") {
    return (
      <>
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

          {/* Text Alignment */}
          <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                onClick={() => update({ textAlign: align })}
                className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
                  selectedProps.textAlign === align
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {align === "left" && <AlignLeft className="w-4 h-4" />}
                {align === "center" && <AlignCenter className="w-4 h-4" />}
                {align === "right" && <AlignRight className="w-4 h-4" />}
              </button>
            ))}
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

        {/* Align Objects */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Align Objects
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5">
              <AlignBtn onClick={() => handleAlign("left")} disabled={!hasMultipleSelection} label="Left"><AlignLeftIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign("centerH")} disabled={!hasMultipleSelection} label="Center"><AlignCenterHIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign("right")} disabled={!hasMultipleSelection} label="Right"><AlignRightIcon /></AlignBtn>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <AlignBtn onClick={() => handleAlign("top")} disabled={!hasMultipleSelection} label="Top"><AlignTopIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign("centerV")} disabled={!hasMultipleSelection} label="Middle"><AlignMiddleIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign("bottom")} disabled={!hasMultipleSelection} label="Bottom"><AlignBottomIcon /></AlignBtn>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
              <div className="grid grid-cols-2 gap-1.5">
                <AlignBtn onClick={() => handleAlign("distributeH")} disabled={!hasThreeOrMore} label="Distribute H"><DistributeHIcon /></AlignBtn>
                <AlignBtn onClick={() => handleAlign("distributeV")} disabled={!hasThreeOrMore} label="Distribute V"><DistributeVIcon /></AlignBtn>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (selectedProps.type === "shape") {
    return (
      <>
        {layoutSection}
        {transformSection}

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
            onChange={(v) => {
              const parsed = Number(v);
              if (!isNaN(parsed) && parsed >= 0)
                update({ strokeWidth: parsed });
            }}
          />
        </div>
      </>
    );
  }

  return null;
}

// ─── Alignment UI Components ─────────────────────────────────────────────────

function AlignBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center gap-1 p-2 rounded-md text-[9px] font-medium transition-all ${
        disabled
          ? "text-zinc-600 cursor-not-allowed opacity-40"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent hover:border-white/10"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// Simple SVG icons for alignment actions (16x16 viewBox)

function AlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <rect x="4" y="3" width="8" height="2" rx="0.5" />
      <rect x="4" y="7" width="6" height="2" rx="0.5" />
      <rect x="4" y="11" width="9" height="2" rx="0.5" />
    </svg>
  );
}

function AlignCenterHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="2" x2="8" y2="14" />
      <rect x="3" y="3" width="10" height="2" rx="0.5" />
      <rect x="5" y="7" width="6" height="2" rx="0.5" />
      <rect x="2" y="11" width="12" height="2" rx="0.5" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="4" y="3" width="8" height="2" rx="0.5" />
      <rect x="6" y="7" width="6" height="2" rx="0.5" />
      <rect x="3" y="11" width="9" height="2" rx="0.5" />
    </svg>
  );
}

function AlignTopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <rect x="3" y="4" width="2" height="8" rx="0.5" />
      <rect x="7" y="4" width="2" height="6" rx="0.5" />
      <rect x="11" y="4" width="2" height="9" rx="0.5" />
    </svg>
  );
}

function AlignMiddleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="8" x2="14" y2="8" />
      <rect x="3" y="3" width="2" height="10" rx="0.5" />
      <rect x="7" y="5" width="2" height="6" rx="0.5" />
      <rect x="11" y="2" width="2" height="12" rx="0.5" />
    </svg>
  );
}

function AlignBottomIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="3" y="4" width="2" height="8" rx="0.5" />
      <rect x="7" y="6" width="2" height="6" rx="0.5" />
      <rect x="11" y="3" width="2" height="9" rx="0.5" />
    </svg>
  );
}

function DistributeHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="2" height="10" rx="0.5" />
      <rect x="7" y="3" width="2" height="10" rx="0.5" />
      <rect x="12" y="3" width="2" height="10" rx="0.5" />
      <line x1="4" y1="8" x2="7" y2="8" strokeDasharray="1.5 1.5" />
      <line x1="9" y1="8" x2="12" y2="8" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function DistributeVIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="2" width="10" height="2" rx="0.5" />
      <rect x="3" y="7" width="10" height="2" rx="0.5" />
      <rect x="3" y="12" width="10" height="2" rx="0.5" />
      <line x1="8" y1="4" x2="8" y2="7" strokeDasharray="1.5 1.5" />
      <line x1="8" y1="9" x2="8" y2="12" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

// ─── Animate Tab ──────────────────────────────────────────────────────────────

function AnimateTab() {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-400"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-1">Animation</h3>
        <p className="text-xs text-zinc-500">
          Animate individual layers with CSS keyframes baked into the exported
          SVG.
        </p>
      </div>
      <button className="px-4 py-2 text-xs font-medium bg-zinc-800 text-zinc-300 border border-white/5 rounded-md hover:bg-zinc-700 transition-colors">
        Coming soon
      </button>
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

interface ExportTabProps {
  onExport?: () => void;
  onCopySvg: () => void;
  onCopyMarkdown: () => void;
  copiedType: "svg" | "markdown" | null;
}

function ExportTab({
  onExport,
  onCopySvg,
  onCopyMarkdown,
  copiedType,
}: ExportTabProps) {
  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Export
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed mb-5">
          Export your banner as a standalone SVG file. Drop it in your repo and
          reference it with a standard markdown image tag.
        </p>

        {/* Format selector */}
        <div className="flex border border-white/5 rounded-md overflow-hidden mb-5">
          <div className="flex-1 py-2.5 px-3 bg-blue-600/20 text-blue-400 text-xs font-medium flex items-center justify-center gap-2 border-r border-white/5">
            <Image className="w-3.5 h-3.5" />
            SVG
          </div>
          <div className="flex-1 py-2.5 px-3 bg-zinc-900 text-zinc-500 text-xs font-medium flex items-center justify-center gap-2">
            <Code className="w-3.5 h-3.5" />
            PNG
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onExport}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md shadow-lg shadow-blue-500/20 transition-all duration-200 border border-blue-500/50"
          >
            <Download className="w-4 h-4" />
            Download SVG
          </button>

          <button
            onClick={onCopySvg}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-medium rounded-md border border-white/5 transition-all duration-200"
          >
            {copiedType === "svg" ? (
              <>
                <Check className="w-4 h-4 text-green-400" /> Copied!
              </>
            ) : (
              <>
                <Clipboard className="w-4 h-4" /> Copy SVG Code
              </>
            )}
          </button>

          <button
            onClick={onCopyMarkdown}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-medium rounded-md border border-white/5 transition-all duration-200"
          >
            {copiedType === "markdown" ? (
              <>
                <Check className="w-4 h-4 text-green-400" /> Copied!
              </>
            ) : (
              <>
                <Clipboard className="w-4 h-4" /> Copy Markdown
              </>
            )}
          </button>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Usage
        </div>
        <ol className="flex flex-col gap-3">
          {[
            { num: "1", text: "Download the SVG file to your project" },
            { num: "2", text: "Place it in your repo alongside README.md" },
            { num: "3", text: "Reference it with a markdown image tag" },
          ].map((step) => (
            <li key={step.num} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-400 shrink-0 mt-0.5">
                {step.num}
              </span>
              <span className="text-xs text-zinc-400 leading-relaxed">
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Markdown snippet */}
      <div className="p-6">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Markdown
        </div>
        <div className="bg-zinc-950 border border-white/5 rounded-md p-3">
          <code className="text-xs text-zinc-400 font-mono break-all">
            ![banner](./banner.svg)
          </code>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
          GitHub, GitLab, and most other markdown renderers will display the SVG
          with any embedded animations.
        </p>
      </div>
    </div>
  );
}
