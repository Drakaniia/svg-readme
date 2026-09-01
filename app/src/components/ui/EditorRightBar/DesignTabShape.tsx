import type { ShapeElementProperties, ElementProperties } from "../../editor-canvas/ElementsRenderer";
import { isGradient, GRADIENT_PRESETS } from "../../../lib/editor/gradient";
import { PropInput } from "./helpers";
import AlignmentControls from "./AlignmentControls";
import GradientEditor from "./GradientEditor";

interface DesignTabShapeProps {
  selectedProps: ShapeElementProperties;
  update: (updates: Partial<ElementProperties>) => void;
  onPropertiesStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  allElementProperties?: Record<string, ElementProperties>;
  allSelectedLayerIds?: string[];
  frameBounds?: { x: number; y: number; width: number; height: number } | null;
}

export function DesignTabShape({
  selectedProps,
  update,
  onPropertiesStart,
  onMoveElement,
  onAlignmentStart,
  allElementProperties,
  allSelectedLayerIds,
  frameBounds,
}: DesignTabShapeProps) {
  return (
    <>
      {/* Appearance — corner radius for rect shapes */}
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
            onChange={(v) => { const parsed = Number(v); if (!isNaN(parsed) && parsed >= 0) update({ cornerRadius: parsed }); }}
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
          onChange={(v) => { const parsed = Number(v); if (!isNaN(parsed) && parsed >= 0) update({ strokeWidth: parsed }); }}
        />

        {/* Stroke dash pattern */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => { const hasDash = !!(selectedProps.strokeDashArray); update({ strokeDashArray: hasDash ? undefined : "6 3" }); }}
            title={selectedProps.strokeDashArray ? "Remove dash" : "Add dash pattern"}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
              selectedProps.strokeDashArray ? "bg-blue-600/20 text-blue-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-white/5"
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
                  if (!isNaN(parsed) && parsed >= 1) { parts[0] = String(parsed); update({ strokeDashArray: parts.join(" ") }); }
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
                  if (!isNaN(parsed) && parsed >= 1) { parts[1] = String(parsed); update({ strokeDashArray: parts.join(" ") }); }
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
              onChange={(e) => { onPropertiesStart?.(); update({ strokeLinecap: e.target.value as "butt" | "round" | "square" }); }}
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
              onChange={(e) => { onPropertiesStart?.(); update({ strokeLinejoin: e.target.value as "miter" | "round" | "bevel" }); }}
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
