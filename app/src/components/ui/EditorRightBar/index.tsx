import { useState } from "react";
import DesignTab from "./DesignTab";
import AnimateTab from "./AnimateTab";
import ExportTab, { type ExportOptions } from "./ExportTab";

export type { ExportOptions };
export { default as ExportTab } from "./ExportTab";

// ─── Props ────────────────────────────────────────────────────────────────────

type RightTab = "design" | "animate" | "export";

interface EditorRightBarProps {
  onExport?: () => void;
  selectedLayerIds?: string[];
  elementProperties?: Record<string, import("../../editor-canvas/ElementsRenderer").ElementProperties>;
  onUpdateProperties?: (id: string, updates: Partial<import("../../editor-canvas/ElementsRenderer").ElementProperties>) => void;
  /** Bulk-edit action applied to ALL currently selected layers (B10 multi-edit). */
  onBulkUpdateProperties?: (updates: Partial<import("../../editor-canvas/ElementsRenderer").ElementProperties>) => void;
  onPropertiesStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  /** Canvas size — used to align a single layer to the frame (B7). */
  frameSize?: { width: number; height: number };
  /** Controlled tab — when provided, TopToolbar drives the active tab */
  activeTab?: RightTab;
  onTabChange?: (tab: RightTab) => void;
}

export default function EditorRightBar({
  onExport,
  selectedLayerIds,
  elementProperties,
  onUpdateProperties,
  onBulkUpdateProperties,
  onPropertiesStart,
  onMoveElement,
  onAlignmentStart,
  frameSize,
  activeTab: controlledTab,
  onTabChange,
}: EditorRightBarProps) {
  const [internalTab, setInternalTab] = useState<RightTab>("design");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (t: RightTab) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };
  const [copiedType, setCopiedType] = useState<"svg" | "markdown" | "png" | null>(null);

  const handleCopySvg = (options?: ExportOptions) => {
    window.dispatchEvent(new CustomEvent("copy-svg-code", { detail: { options } }));
    setCopiedType("svg");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyMarkdown = (options?: ExportOptions) => {
    window.dispatchEvent(new CustomEvent("copy-markdown", { detail: { options } }));
    setCopiedType("markdown");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleExportPng = (options?: ExportOptions) => {
    window.dispatchEvent(new CustomEvent("export-png", { detail: { options } }));
  };

  const handleCopyImage = (options?: ExportOptions) => {
    window.dispatchEvent(new CustomEvent("copy-png-image", { detail: { options } }));
    setCopiedType("png");
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Determine selected element
  const selectedId =
    selectedLayerIds && selectedLayerIds.length === 1
      ? selectedLayerIds[0]
      : null;
  const selectedProps =
    selectedId && elementProperties ? elementProperties[selectedId] : null;

  const isControlled = controlledTab !== undefined;
  return (
    <aside className="w-80 shrink-0 border-l border-white/5 bg-[#09090b]/95 backdrop-blur-xl flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.2)]">
      {/* Tab headers — hidden when controlled via TopToolbar */}
      {!isControlled && (
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
      )}
      <div className={`flex-1 overflow-y-auto overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent ${isControlled ? "pt-2" : ""}`}>
        {activeTab === "design" && (
          <DesignTab
            selectedId={selectedId}
            selectedProps={selectedProps}
            onUpdateProperties={onUpdateProperties}
            onBulkUpdateProperties={onBulkUpdateProperties}
            onPropertiesStart={onPropertiesStart}
            onMoveElement={onMoveElement}
            onAlignmentStart={onAlignmentStart}
            multiSelectCount={selectedLayerIds?.length ?? 0}
            allElementProperties={elementProperties}
            allSelectedLayerIds={selectedLayerIds}
            frameSize={frameSize}
          />
        )}
        {activeTab === "animate" && <AnimateTab />}
        {activeTab === "export" && (
          <ExportTab
            onExport={onExport}
            onExportPng={handleExportPng}
            onCopySvg={handleCopySvg}
            onCopyMarkdown={handleCopyMarkdown}
            onCopyImage={handleCopyImage}
            copiedType={copiedType}
          />
        )}
      </div>
    </aside>
  );
}
