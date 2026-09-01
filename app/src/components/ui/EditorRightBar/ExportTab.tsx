import { useState, useEffect } from "react";
import {
  DownloadSimple,
  Clipboard,
  Code,
  Image,
  Check,
  Play,
} from "@phosphor-icons/react";

// ─── Export Tab ───────────────────────────────────────────────────────────────

// ─── Export Tab ───────────────────────────────────────────────────────────────

/** Export options controlled from the Export tab (A12/E). */
export interface ExportOptions {
  backgroundColor: string;
  transparent: boolean;
  rounded: boolean;
  borderRadius: number;
  showBorder: boolean;
  filename: string;
  pngScale: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  backgroundColor: "#09090b",
  transparent: false,
  rounded: true,
  borderRadius: 12,
  showBorder: true,
  filename: "banner",
  pngScale: 2,
};

interface ExportTabProps {
  onExport?: (options?: ExportOptions) => void;
  onExportPng?: (options?: ExportOptions) => void;
  onCopySvg: (options?: ExportOptions) => void;
  onCopyMarkdown: (options?: ExportOptions) => void;
  onCopyImage?: (options?: ExportOptions) => void;
  copiedType: "svg" | "markdown" | "png" | null;
}

function ExportTab({
  onExport,
  onExportPng,
  onCopySvg,
  onCopyMarkdown,
  onCopyImage,
  copiedType,
}: ExportTabProps) {
  const [format, setFormat] = useState<"svg" | "png" | "animated">("svg");
  const [animFps, setAnimFps] = useState(15);
  const [animFormat, setAnimFormat] = useState<"gif" | "png-sequence">("gif");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  // Export options (A12/E) — previously hardcoded in export.ts
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_EXPORT_OPTIONS.backgroundColor);
  const [transparent, setTransparent] = useState(DEFAULT_EXPORT_OPTIONS.transparent);
  const [rounded, setRounded] = useState(DEFAULT_EXPORT_OPTIONS.rounded);
  const [borderRadius, setBorderRadius] = useState(DEFAULT_EXPORT_OPTIONS.borderRadius);
  const [showBorder, setShowBorder] = useState(DEFAULT_EXPORT_OPTIONS.showBorder);
  const [filename, setFilename] = useState(DEFAULT_EXPORT_OPTIONS.filename);
  const [pngScale, setPngScale] = useState(DEFAULT_EXPORT_OPTIONS.pngScale);

  const exportOptions: ExportOptions = {
    backgroundColor,
    transparent,
    rounded,
    borderRadius,
    showBorder,
    filename: filename.trim() || "banner",
    pngScale,
  };

  // Listen for animated export progress updates
  useEffect(() => {
    const handleProgress = (e: Event) => {
      const { current, total } = (e as CustomEvent).detail;
      setExportProgress(current);
      setExportTotal(total);
      if (current >= total) {
        setTimeout(() => {
          setExporting(false);
          setExportProgress(0);
          setExportTotal(0);
        }, 500);
      }
    };
    window.addEventListener("export-animated-progress", handleProgress);
    return () => window.removeEventListener("export-animated-progress", handleProgress);
  }, []);

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-4 font-semibold">
          Export
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed mb-5">
          Export your banner as a standalone SVG or PNG file. Drop it in your
          repo and reference it with a standard markdown image tag.
        </p>

        {/* Format selector */}
        <div className="flex border border-white/5 rounded-md overflow-hidden mb-5">
          <button
            onClick={() => setFormat("svg")}
            className={`flex-1 py-2.5 px-2 text-xs font-medium flex items-center justify-center gap-1.5 border-r border-white/5 transition-colors cursor-pointer ${
              format === "svg"
                ? "bg-blue-600/20 text-blue-400"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Code className="w-3 h-3" />
            SVG
          </button>
          <button
            onClick={() => setFormat("png")}
            className={`flex-1 py-2.5 px-2 text-xs font-medium flex items-center justify-center gap-1.5 border-r border-white/5 transition-colors cursor-pointer ${
              format === "png"
                ? "bg-blue-600/20 text-blue-400"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Image className="w-3 h-3" />
            PNG
          </button>
          <button
            onClick={() => setFormat("animated")}
            className={`flex-1 py-2.5 px-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              format === "animated"
                ? "bg-blue-600/20 text-blue-400"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Play className="w-3 h-3" />
            Animated
          </button>
        </div>

        {/* Export options (A12/E) — shared by SVG and PNG exports */}
        {(format === "svg" || format === "png") && (
          <div className="mb-5 flex flex-col gap-3 border border-white/5 rounded-lg p-3 bg-zinc-900/40">
            <span className="text-[10px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
              Options
            </span>

            {/* Background color + transparent */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Background</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  disabled={transparent}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-7 h-7 rounded border border-white/10 cursor-pointer bg-transparent disabled:opacity-30"
                  aria-label="Export background color"
                />
                <button
                  onClick={() => setTransparent((t) => !t)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                    transparent
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                      : "text-zinc-400 hover:text-zinc-200 border-white/10 hover:bg-white/5"
                  }`}
                  aria-pressed={transparent}
                >
                  Transparent
                </button>
              </div>
            </div>

            {/* Rounded corners + radius */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Rounded corners</span>
              <button
                onClick={() => setRounded((r) => !r)}
                className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                  rounded
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                    : "text-zinc-400 hover:text-zinc-200 border-white/10 hover:bg-white/5"
                }`}
                aria-pressed={rounded}
              >
                {rounded ? "On" : "Off"}
              </button>
            </div>
            {rounded && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">Radius</span>
                <input
                  type="number"
                  min={0}
                  value={borderRadius}
                  onChange={(e) =>
                    setBorderRadius(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="flex-1 min-w-0 bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-xs text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
                  aria-label="Export corner radius"
                />
              </div>
            )}

            {/* Border */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Border</span>
              <button
                onClick={() => setShowBorder((b) => !b)}
                className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                  showBorder
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                    : "text-zinc-400 hover:text-zinc-200 border-white/10 hover:bg-white/5"
                }`}
                aria-pressed={showBorder}
              >
                {showBorder ? "On" : "Off"}
              </button>
            </div>

            {/* Filename */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Filename</span>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-xs text-zinc-300 outline-none focus:border-blue-500/50 font-mono"
                aria-label="Export filename"
              />
              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                {format === "svg" ? ".svg" : ".png"}
              </span>
            </div>

            {/* PNG scale */}
            {format === "png" && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-500 font-mono">Scale</span>
                <select
                  value={pngScale}
                  onChange={(e) => setPngScale(Number(e.target.value))}
                  className="bg-zinc-950 border border-white/5 rounded-md px-2 py-1 text-xs text-zinc-300 outline-none focus:border-blue-500/50 cursor-pointer font-mono"
                  aria-label="PNG export scale"
                >
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={3}>3×</option>
                  <option value={4}>4×</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Export Actions */}
        <div className="flex flex-col gap-2">
          {format === "svg" && (
            <>
              <button
                onClick={() => onExport?.(exportOptions)}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md shadow-lg shadow-blue-500/20 transition-all duration-200 border border-blue-500/50"
              >
                <DownloadSimple className="w-4 h-4" />
                Download SVG
              </button>
              <button
                onClick={() => onCopySvg(exportOptions)}
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
                onClick={() => onCopyMarkdown(exportOptions)}
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
            </>
          )}
          {format === "png" && (
            <>
              <button
                onClick={() => onExportPng?.(exportOptions)}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md shadow-lg shadow-blue-500/20 transition-all duration-200 border border-blue-500/50"
              >
                <DownloadSimple className="w-4 h-4" />
                Download PNG
              </button>
              {onCopyImage && (
                <button
                  onClick={() => onCopyImage(exportOptions)}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-medium rounded-md border border-white/5 transition-all duration-200"
                >
                  {copiedType === "png" ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-4 h-4" /> Copy as Image
                    </>
                  )}
                </button>
              )}
            </>
          )}
          {format === "animated" && (
            <>
              {/* Animated export options */}
              <div className="space-y-3">
                {/* FPS selector */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">Frame Rate</span>
                  <select
                    value={animFps}
                    onChange={(e) => setAnimFps(Number(e.target.value))}
                    className="bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    {[5, 10, 12, 15, 20, 24, 30].map((f) => (
                      <option key={f} value={f}>{f} fps</option>
                    ))}
                  </select>
                </div>

                {/* Format toggle */}
                <div className="flex border border-white/5 rounded-md overflow-hidden">
                  <button
                    onClick={() => setAnimFormat("gif")}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      animFormat === "gif"
                        ? "bg-blue-600/20 text-blue-400"
                        : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    GIF
                  </button>
                  <button
                    onClick={() => setAnimFormat("png-sequence")}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      animFormat === "png-sequence"
                        ? "bg-blue-600/20 text-blue-400"
                        : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    PNG Sequence
                  </button>
                </div>

                {/* Export button */}
                <button
                  onClick={() => {
                    if (exporting) return;
                    setExporting(true);
                    setExportProgress(0);
                    window.dispatchEvent(new CustomEvent("export-animated", {
                      detail: { fps: animFps, format: animFormat },
                    }));
                  }}
                  disabled={exporting}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-md shadow-lg transition-all duration-200 border ${
                    exporting
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border-white/5"
                      : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 shadow-blue-500/20"
                  }`}
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                      </svg>
                      Rendering...
                    </>
                  ) : (
                    <>
                      <DownloadSimple className="w-4 h-4" />
                      Export Animated {animFormat === "gif" ? "GIF" : "PNG Sequence"}
                    </>
                  )}
                </button>

                {/* Progress bar */}
                {exporting && exportTotal > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-200"
                        style={{ width: `${exportTotal > 0 ? (exportProgress / exportTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center font-mono">
                      Frame {exportProgress} / {exportTotal}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                Captures each animation frame and exports as {animFormat === "gif" ? "a GIF" : "individual PNGs"}.
                Best for sharing animated SVGs on platforms that don{"'"}t support CSS @keyframes.
              </p>
            </>
          )}
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

export default ExportTab;
