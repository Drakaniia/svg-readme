import { useState, useCallback } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Move,
  Eye,
  Download,
  Clipboard,
  Code,
  Image,
  Check,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import type { TextElementProperties } from "../editor-canvas/ElementsRenderer";
import { getTextBoundingBox } from "../editor-canvas/ElementsRenderer";
import ColorPickerPopover from "./ColorPickerPopover";

interface EditorRightBarProps {
  onExport?: () => void;
  elementProperties: Record<string, TextElementProperties>;
  selectedLayerIds: string[];
  onMoveElement: (id: string, x: number, y: number) => void;
  onUpdateElementProperty: (
    id: string,
    updates: Partial<TextElementProperties>,
  ) => void;
}

export default function EditorRightBar({
  onExport,
  elementProperties,
  selectedLayerIds,
  onMoveElement,
  onUpdateElementProperty,
}: EditorRightBarProps) {
  const [activeTab, setActiveTab] = useState<"design" | "animate" | "export">(
    "design",
  );
  const [copiedType, setCopiedType] = useState<"svg" | "markdown" | null>(null);

  const handleCopySvg = async () => {
    // We need to get the SVG string - we'll copy from the export function
    // For now, dispatch a custom event that Editor.tsx listens to
    window.dispatchEvent(new CustomEvent("copy-svg-code"));
    setCopiedType("svg");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyMarkdown = async () => {
    window.dispatchEvent(new CustomEvent("copy-markdown"));
    setCopiedType("markdown");
    setTimeout(() => setCopiedType(null), 2000);
  };

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
            elementProperties={elementProperties}
            selectedLayerIds={selectedLayerIds}
            onMoveElement={onMoveElement}
            onUpdateElementProperty={onUpdateElementProperty}
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

// ─── Design Tab ───────────────────────────────────────────────────────────────

interface DesignTabProps {
  elementProperties: Record<string, TextElementProperties>;
  selectedLayerIds: string[];
  onMoveElement: (id: string, x: number, y: number) => void;
  onUpdateElementProperty: (
    id: string,
    updates: Partial<TextElementProperties>,
  ) => void;
}

function DesignTab({
  elementProperties,
  selectedLayerIds,
  onMoveElement,
  onUpdateElementProperty,
}: DesignTabProps) {
  const { selectedLayerId } = useEditor();
  const props = selectedLayerId ? elementProperties[selectedLayerId] : null;
  const hasMultipleSelection = selectedLayerIds.length >= 2;
  const hasThreeOrMore = selectedLayerIds.length >= 3;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!props) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center mb-3">
          <Move className="w-4 h-4 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-500">
          Select a layer to edit its properties
        </p>
      </div>
    );
  }

  if (!selectedLayerId) return null;

  // ── Layout handlers ──────────────────────────────────────────────────────
  const handleXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onUpdateElementProperty(selectedLayerId, { x: val });
  };

  const handleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onUpdateElementProperty(selectedLayerId, { y: val });
  };

  const handleWChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "auto") {
      onUpdateElementProperty(selectedLayerId, { width: "auto" });
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) onUpdateElementProperty(selectedLayerId, { width: num });
    }
  };

  const handleHChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) onUpdateElementProperty(selectedLayerId, { height: val });
  };

  // ── Typography handlers ──────────────────────────────────────────────────
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateElementProperty(selectedLayerId, { fontFamily: e.target.value });
  };

  const FONT_WEIGHT_MAP: Record<string, number> = {
    Regular: 400,
    Medium: 500,
    SemiBold: 600,
    Bold: 700,
  };
  const WEIGHT_TO_LABEL: Record<number, string> = {
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
  };

  const handleFontWeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const w = FONT_WEIGHT_MAP[e.target.value];
    if (w) onUpdateElementProperty(selectedLayerId, { fontWeight: w });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val))
      onUpdateElementProperty(selectedLayerId, { fontSize: val });
  };

  const handleTextAlignChange = (align: "left" | "center" | "right") => {
    if (!selectedLayerId || !props) return;

    // Compute the text width for position compensation.
    // x represents the textAnchor point: left edge (left), center (center), or right edge (right).
    // When changing alignment, we adjust x so the visual position stays the same.
    // IMPORTANT: always use the actual rendered text width, not the fixed box width,
    // so alignment changes don't incorrectly shift x by hundreds of pixels.
    const charWidth = props.fontSize * 0.6;
    const textWidth = Math.max(props.content.length * charWidth, 20);

    // Current visual left edge of the text
    let visualLeft = props.x;
    if (props.textAlign === "center") visualLeft = props.x - textWidth / 2;
    else if (props.textAlign === "right") visualLeft = props.x - textWidth;

    // New x that keeps the visual left edge the same with the new alignment
    let newX = visualLeft;
    if (align === "center") newX = visualLeft + textWidth / 2;
    else if (align === "right") newX = visualLeft + textWidth;

    onUpdateElementProperty(selectedLayerId, {
      textAlign: align,
      x: Math.round(newX),
    });
  };

  // ── Background remove handler ──────────────────────────────────────────────
  const handleRemoveBackground = () => {
    onUpdateElementProperty(selectedLayerId, { backgroundColor: undefined });
  };

  // ── Alignment handlers ──────────────────────────────────────────────────
  const handleAlign = useCallback(
    (alignType: string) => {
      const selected = selectedLayerIds.filter((id) => elementProperties[id]);
      if (selected.length < 2) return;

      const bbs = selected.map((id) => ({
        id,
        bb: getTextBoundingBox(elementProperties[id]),
        props: elementProperties[id],
      }));

      switch (alignType) {
        case "left": {
          const minX = Math.min(...bbs.map((b) => b.bb.x));
          bbs.forEach((b) => {
            onMoveElement(b.id, b.props.x + (minX - b.bb.x), b.props.y);
          });
          break;
        }
        case "centerH": {
          const avgCenter =
            bbs.reduce((sum, b) => sum + b.bb.x + b.bb.width / 2, 0) /
            bbs.length;
          bbs.forEach((b) => {
            onMoveElement(
              b.id,
              b.props.x + (avgCenter - b.bb.width / 2 - b.bb.x),
              b.props.y,
            );
          });
          break;
        }
        case "right": {
          const maxRight = Math.max(...bbs.map((b) => b.bb.x + b.bb.width));
          bbs.forEach((b) => {
            onMoveElement(
              b.id,
              b.props.x + (maxRight - b.bb.width - b.bb.x),
              b.props.y,
            );
          });
          break;
        }
        case "top": {
          const minY = Math.min(...bbs.map((b) => b.bb.y));
          bbs.forEach((b) => {
            onMoveElement(b.id, b.props.x, b.props.y + (minY - b.bb.y));
          });
          break;
        }
        case "centerV": {
          const avgCenter =
            bbs.reduce((sum, b) => sum + b.bb.y + b.bb.height / 2, 0) /
            bbs.length;
          bbs.forEach((b) => {
            onMoveElement(
              b.id,
              b.props.x,
              b.props.y + (avgCenter - b.bb.height / 2 - b.bb.y),
            );
          });
          break;
        }
        case "bottom": {
          const maxBottom = Math.max(
            ...bbs.map((b) => b.bb.y + b.bb.height),
          );
          bbs.forEach((b) => {
            onMoveElement(
              b.id,
              b.props.x,
              b.props.y + (maxBottom - b.bb.height - b.bb.y),
            );
          });
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
          sorted.forEach((b) => {
            onMoveElement(b.id, b.props.x + (curX - b.bb.x), b.props.y);
            curX += b.bb.width + gap;
          });
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
          sorted.forEach((b) => {
            onMoveElement(b.id, b.props.x, b.props.y + (curY - b.bb.y));
            curY += b.bb.height + gap;
          });
          break;
        }
      }
    },
    [selectedLayerIds, elementProperties, onMoveElement],
  );

  return (
    <>
      {/* Layout Section */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Layout
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <span className="text-zinc-500 text-xs font-mono">X</span>
            <input
              type="text"
              value={Math.round(props.x)}
              onChange={handleXChange}
              className="bg-transparent text-sm w-full outline-none text-zinc-300"
            />
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <span className="text-zinc-500 text-xs font-mono">Y</span>
            <input
              type="text"
              value={Math.round(props.y)}
              onChange={handleYChange}
              className="bg-transparent text-sm w-full outline-none text-zinc-300"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <span className="text-zinc-500 text-xs font-mono">W</span>
            <input
              type="text"
              value={props.width === "auto" ? "auto" : Math.round(props.width)}
              onChange={handleWChange}
              className="bg-transparent text-sm w-full outline-none text-zinc-300"
            />
          </div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <span className="text-zinc-500 text-xs font-mono">H</span>
            <input
              type="text"
              value={Math.round(props.height)}
              onChange={handleHChange}
              className="bg-transparent text-sm w-full outline-none text-zinc-300"
            />
          </div>
        </div>
      </div>

      {/* Typography Section */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Typography
        </div>

        <div className="relative mb-4">
          <select
            value={props.fontFamily}
            onChange={handleFontFamilyChange}
            className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
          >
            <option value="Inter">Inter</option>
            <option value="Poppins">Poppins</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
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

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <select
              value={WEIGHT_TO_LABEL[props.fontWeight] ?? "Regular"}
              onChange={handleFontWeightChange}
              className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="Regular">Regular</option>
              <option value="Medium">Medium</option>
              <option value="SemiBold">SemiBold</option>
              <option value="Bold">Bold</option>
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
          <div className="w-20 bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 flex items-center focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <input
              type="text"
              value={props.fontSize}
              onChange={handleFontSizeChange}
              className="bg-transparent text-sm w-full outline-none text-zinc-300 text-center"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
          <button
            onClick={() => handleTextAlignChange("left")}
            className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
              props.textAlign === "left"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTextAlignChange("center")}
            className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
              props.textAlign === "center"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTextAlignChange("right")}
            className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
              props.textAlign === "right"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button className="flex-1 p-2 rounded text-zinc-400 flex items-center justify-center transition-colors opacity-40 cursor-not-allowed">
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Align Objects Section */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Align Objects
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-1.5">
            <AlignBtn
              onClick={() => handleAlign("left")}
              disabled={!hasMultipleSelection}
              label="Left"
            >
              <AlignLeftIcon />
            </AlignBtn>
            <AlignBtn
              onClick={() => handleAlign("centerH")}
              disabled={!hasMultipleSelection}
              label="Center"
            >
              <AlignCenterHIcon />
            </AlignBtn>
            <AlignBtn
              onClick={() => handleAlign("right")}
              disabled={!hasMultipleSelection}
              label="Right"
            >
              <AlignRightIcon />
            </AlignBtn>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <AlignBtn
              onClick={() => handleAlign("top")}
              disabled={!hasMultipleSelection}
              label="Top"
            >
              <AlignTopIcon />
            </AlignBtn>
            <AlignBtn
              onClick={() => handleAlign("centerV")}
              disabled={!hasMultipleSelection}
              label="Middle"
            >
              <AlignMiddleIcon />
            </AlignBtn>
            <AlignBtn
              onClick={() => handleAlign("bottom")}
              disabled={!hasMultipleSelection}
              label="Bottom"
            >
              <AlignBottomIcon />
            </AlignBtn>
          </div>
          <div className="mt-2 pt-2 border-t border-white/5">
            <div className="grid grid-cols-2 gap-1.5">
              <AlignBtn
                onClick={() => handleAlign("distributeH")}
                disabled={!hasThreeOrMore}
                label="Distribute H"
              >
                <DistributeHIcon />
              </AlignBtn>
              <AlignBtn
                onClick={() => handleAlign("distributeV")}
                disabled={!hasThreeOrMore}
                label="Distribute V"
              >
                <DistributeVIcon />
              </AlignBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Text Color Section — clicking the swatch opens ColorPickerPopover */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Text Color
        </div>
        <ColorPickerPopover
          value={props.color}
          onChange={(hex) =>
            onUpdateElementProperty(selectedLayerId, { color: hex })
          }
        />
      </div>

      {/* Background Fill Section — clicking the swatch opens ColorPickerPopover */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
            Background Fill
          </div>
          {props.backgroundColor && (
            <button
              onClick={handleRemoveBackground}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-wider transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {props.backgroundColor ? (
          <ColorPickerPopover
            value={props.backgroundColor}
            onChange={(hex) =>
              onUpdateElementProperty(selectedLayerId, {
                backgroundColor: hex,
              })
            }
          />
        ) : (
          <button
            onClick={() =>
              onUpdateElementProperty(selectedLayerId, {
                backgroundColor: "#333333",
              })
            }
            className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 border border-dashed border-white/10 hover:border-white/20 rounded-md transition-colors font-medium"
          >
            + Add background fill
          </button>
        )}
      </div>

      {/* Effects Section */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold flex justify-between items-center">
          Effects
          <button className="text-zinc-400 hover:text-white transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between text-sm text-zinc-300 py-2 group cursor-pointer hover:bg-white/5 rounded px-3 -mx-3 transition-colors">
          <span className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            Drop Shadow
          </span>
          <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <Move className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
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
