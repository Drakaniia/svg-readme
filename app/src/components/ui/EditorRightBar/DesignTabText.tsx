import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  ArrowsLeftRight,
  TextColumns,
  Lock,
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
} from "@phosphor-icons/react";
import type { TextElementProperties, ElementProperties } from "../../editor-canvas/ElementsRenderer";
import ColorPickerPopover from "../ColorPickerPopover";
import { PropInput } from "./helpers";
import AlignmentControls from "./AlignmentControls";

interface DesignTabTextProps {
  selectedProps: TextElementProperties;
  update: (updates: Partial<ElementProperties>) => void;
  onPropertiesStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  allElementProperties?: Record<string, ElementProperties>;
  allSelectedLayerIds?: string[];
  frameBounds?: { x: number; y: number; width: number; height: number } | null;
}

export function DesignTabText({
  selectedProps,
  update,
  onPropertiesStart: _onPropertiesStart,
  onMoveElement,
  onAlignmentStart,
  allElementProperties,
  allSelectedLayerIds,
  frameBounds,
}: DesignTabTextProps) {
  return (
    <>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <select
              value={String(selectedProps.fontWeight)}
              onChange={(e) => update({ fontWeight: Number(e.target.value) })}
              className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">SemiBold</option>
              <option value="700">Bold</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              if (!isNaN(parsed) && parsed > 0) update({ fontSize: parsed });
            }}
          />
        </div>

        {/* Text Alignment — horizontal */}
        <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
          {(["left", "center", "right", "justify"] as const).map((align) => (
            <button
              key={align}
              onClick={() => update({ textAlign: align })}
              title={`Align ${align}`}
              className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
                selectedProps.textAlign === align ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {align === "left" && <TextAlignLeft className="w-4 h-4" />}
              {align === "center" && <TextAlignCenter className="w-4 h-4" />}
              {align === "right" && <TextAlignRight className="w-4 h-4" />}
              {align === "justify" && <TextAlignJustify className="w-4 h-4" />}
            </button>
          ))}
        </div>

        {/* Vertical alignment */}
        <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
          {(["top", "center", "bottom"] as const).map((align) => (
            <button
              key={align}
              onClick={() => update({ textAlignVertical: align })}
              title={`Align vertical ${align}`}
              className={`flex-1 p-2 rounded flex items-center justify-center transition-colors ${
                (selectedProps.textAlignVertical ?? "top") === align ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {align === "top" && <AlignTop className="w-4 h-4" />}
              {align === "center" && <AlignCenterVertical className="w-4 h-4" />}
              {align === "bottom" && <AlignBottom className="w-4 h-4" />}
            </button>
          ))}
        </div>

        {/* Resizing mode */}
        <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
          {([
            { value: "WIDTH_AND_HEIGHT" as const, label: "Auto W", title: "Auto width & height" },
            { value: "HEIGHT" as const, label: "Auto H", title: "Auto height, fixed width" },
            { value: "NONE" as const, label: "Fixed", title: "Fixed size" },
          ]).map((mode) => (
            <button
              key={mode.value}
              onClick={() => update({ textAutoResize: mode.value })}
              title={mode.title}
              className={`flex-1 p-2 rounded flex items-center justify-center gap-1.5 transition-colors ${
                (selectedProps.textAutoResize ?? "NONE") === mode.value ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {mode.value === "WIDTH_AND_HEIGHT" && <ArrowsLeftRight className="w-3.5 h-3.5" />}
              {mode.value === "HEIGHT" && <TextColumns className="w-3.5 h-3.5" />}
              {mode.value === "NONE" && <Lock className="w-3.5 h-3.5" />}
              <span className="text-[9px] font-medium">{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Line height + Letter spacing */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PropInput
            label="LH"
            value={String(Math.round(selectedProps.lineHeight ?? selectedProps.fontSize * 1.4))}
            type="number"
            onChange={(v) => { const parsed = Number(v); if (!isNaN(parsed) && parsed > 0) update({ lineHeight: parsed }); }}
          />
          <PropInput
            label="LS"
            value={String(selectedProps.letterSpacing ?? 0)}
            type="number"
            onChange={(v) => { const parsed = Number(v); if (!isNaN(parsed)) update({ letterSpacing: parsed }); }}
          />
        </div>

        {/* Formatting toolbar */}
        <div className="mt-2 flex items-center gap-1.5 bg-zinc-900/50 p-1.5 rounded-md border border-white/5">
          <button
            onClick={() => update({ fontWeight: selectedProps.fontWeight === 700 ? 400 : 700 })}
            title="Bold"
            className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${selectedProps.fontWeight === 700 ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <TextB className="w-4 h-4" />
          </button>
          <button
            onClick={() => update({ italic: !selectedProps.italic })}
            title="Italic"
            className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${selectedProps.italic ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <TextItalic className="w-4 h-4" />
          </button>
          <button
            onClick={() => update({ textDecoration: selectedProps.textDecoration === "UNDERLINE" ? "NONE" : "UNDERLINE" })}
            title="Underline"
            className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${selectedProps.textDecoration === "UNDERLINE" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <TextUnderline className="w-4 h-4" />
          </button>
          <button
            onClick={() => update({ textDecoration: selectedProps.textDecoration === "STRIKETHROUGH" ? "NONE" : "STRIKETHROUGH" })}
            title="Strikethrough"
            className={`p-2 rounded flex-1 flex items-center justify-center transition-colors ${selectedProps.textDecoration === "STRIKETHROUGH" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <TextStrikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Text case */}
        <div className="mt-2">
          <select
            value={selectedProps.textCase ?? "ORIGINAL"}
            onChange={(e) => update({ textCase: e.target.value as "ORIGINAL" | "UPPER" | "LOWER" | "TITLE" })}
            className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2 text-xs text-zinc-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
          >
            <option value="ORIGINAL">Original</option>
            <option value="UPPER">UPPERCASE</option>
            <option value="LOWER">lowercase</option>
            <option value="TITLE">Title Case</option>
          </select>
        </div>
      </div>

      {/* Text Color */}
      <div className="p-5 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Text Color
        </div>
        <ColorPickerPopover value={selectedProps.color} onChange={(hex) => update({ color: hex })} />
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
          <ColorPickerPopover value={selectedProps.backgroundColor} onChange={(hex) => update({ backgroundColor: hex })} />
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
