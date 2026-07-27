import { useState } from "react";
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
  ImagePlus,
} from "lucide-react";
import type { ElementProperties } from "../editor-canvas/ElementsRenderer";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorRightBarProps {
  onExport?: () => void;
  selectedLayerIds?: string[];
  elementProperties?: Record<string, ElementProperties>;
  onUpdateProperties?: (
    id: string,
    updates: Partial<ElementProperties>,
  ) => void;
}

export default function EditorRightBar({
  onExport,
  selectedLayerIds,
  elementProperties,
  onUpdateProperties,
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
            multiSelectCount={selectedLayerIds?.length ?? 0}
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
  onUpdateProperties?: (
    id: string,
    updates: Partial<ElementProperties>,
  ) => void;
  multiSelectCount: number;
}

function DesignTab({
  selectedId,
  selectedProps,
  onUpdateProperties,
  multiSelectCount,
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

        {/* Fill (text color) */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Color
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={selectedProps.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={selectedProps.color}
              onChange={(e) => update({ color: e.target.value })}
              className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500/50 transition-all font-mono"
            />
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

  if (selectedProps.type === "image") {
    return (
      <>
        {layoutSection}
        {transformSection}

        {/* Image Info */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Image
          </div>
          {/* Thumbnail preview */}
          <div className="relative w-full aspect-video bg-zinc-900 border border-white/5 rounded-lg overflow-hidden mb-3">
            <img
              src={selectedProps.url}
              alt="Selected"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Image is embedded as a base64 data URL in the exported SVG.
          </p>
        </div>
      </>
    );
  }

  return null;
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
