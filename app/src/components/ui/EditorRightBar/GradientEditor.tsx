import type { GradientFill } from "../../../lib/editor/gradient";

// ─── Gradient Editor ────────────────────────────────────────────────────────────

interface GradientEditorProps {
  gradient: GradientFill;
  onChange: (g: GradientFill) => void;
}

function GradientEditor({ gradient, onChange }: GradientEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Type toggle */}
      <div className="flex border border-white/5 rounded-md overflow-hidden">
        <button
          onClick={() =>
            onChange({
              type: "linear",
              angle: 135,
              stops: gradient.stops,
            })
          }
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            gradient.type === "linear"
              ? "bg-blue-600/20 text-blue-400"
              : "bg-zinc-900 text-zinc-500"
          }`}
        >
          Linear
        </button>
        <button
          onClick={() =>
            onChange({
              type: "radial",
              cx: 0.5,
              cy: 0.5,
              stops: gradient.stops,
            })
          }
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            gradient.type === "radial"
              ? "bg-blue-600/20 text-blue-400"
              : "bg-zinc-900 text-zinc-500"
          }`}
        >
          Radial
        </button>
      </div>
      {/* Angle (linear only) */}
      {gradient.type === "linear" && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 font-mono w-6">Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={gradient.angle}
            onChange={(e) =>
              onChange({ ...gradient, angle: Number(e.target.value) })
            }
            className="flex-1 h-1 accent-blue-500"
          />
          <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">
            {gradient.angle}°
          </span>
        </div>
      )}
      {/* Stops */}
      <div className="flex flex-col gap-1.5">
        {gradient.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono w-4">
              {i + 1}
            </span>
            <input
              type="color"
              value={stop.color}
              onChange={(e) => {
                const newStops = [...gradient.stops];
                newStops[i] = { ...stop, color: e.target.value };
                onChange({ ...gradient, stops: newStops });
              }}
              className="w-6 h-6 rounded border border-white/10 cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={stop.color}
              onChange={(e) => {
                const newStops = [...gradient.stops];
                newStops[i] = { ...stop, color: e.target.value };
                onChange({ ...gradient, stops: newStops });
              }}
              className="flex-1 bg-zinc-900 border border-white/5 rounded px-2 py-1 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500/50"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(stop.offset * 100)}
              onChange={(e) => {
                const newStops = [...gradient.stops];
                newStops[i] = { ...stop, offset: Number(e.target.value) / 100 };
                onChange({ ...gradient, stops: newStops });
              }}
              className="w-16 h-1 accent-blue-500"
            />
            {gradient.stops.length > 2 && (
              <button
                onClick={() => {
                  const newStops = gradient.stops.filter((_, j) => j !== i);
                  onChange({ ...gradient, stops: newStops });
                }}
                className="text-zinc-600 hover:text-red-400 text-xs"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Add stop */}
      {gradient.stops.length < 5 && (
        <button
          onClick={() => {
            const newStops = [
              ...gradient.stops,
              { offset: 0.5, color: "#ffffff" },
            ].sort((a, b) => a.offset - b.offset);
            onChange({ ...gradient, stops: newStops });
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300 py-1 border border-dashed border-white/10 hover:border-white/20 rounded transition-colors"
        >
          + Add stop
        </button>
      )}
      {/* Preview bar */}
      <div
        className="h-4 rounded border border-white/10"
        style={{
          background:
            gradient.type === "linear"
              ? `linear-gradient(${gradient.angle}deg, ${gradient.stops
                  .map((s) => `${s.color} ${s.offset * 100}%`)
                  .join(", ")})`
              : `radial-gradient(circle at ${gradient.cx * 100}% ${gradient.cy * 100}%, ${gradient.stops
                  .map((s) => `${s.color} ${s.offset * 100}%`)
                  .join(", ")})`,
        }}
      />
    </div>
  );
}

export default GradientEditor;
