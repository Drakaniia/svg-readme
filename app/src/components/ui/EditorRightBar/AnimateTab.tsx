import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Zap,
  Trash2,
  Layers,
  Wand,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { ElementProperties, AnimationConfig } from "../../editor-canvas/ElementsRenderer";
import { ANIMATION_PRESETS } from "../../editor-canvas/ElementsRenderer";
import { generateEasingSvgPath, applyAnimationToLayers, applyStaggeredAnimation } from "../../../lib/editor/animationUtils";
import TimelineEditor from "../TimelineEditor";
import { useEditor } from "../../../context/EditorContext";

// ─── Animate Tab ──────────────────────────────────────────────────────────────

/** Inline SVG easing curve visualizer */
function EasingViz({ easing, w = 120, h = 48 }: { easing: string; w?: number; h?: number }) {
  const path = generateEasingSvgPath(easing, w, h);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="block rounded border border-white/5 bg-zinc-950 overflow-hidden shrink-0"
    >
      {/* Grid lines */}
      <line x1={0} y1={h} x2={w} y2={0} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="2 4" />
      <line x1={0} y1={0} x2={w} y2={0} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      <line x1={0} y1={h} x2={w} y2={h} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
      {/* Easing curve */}
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" />
      {/* Start/End dots */}
      <circle cx={0} cy={h} r={2} fill="#3b82f6" />
      <circle cx={w} cy={0} r={2} fill="#8b5cf6" />
    </svg>
  );
}

function AnimateTab() {
  const {
    selectedLayerIds,
    elementProperties,
    setElementProperties,
    previewAnimation,
    setPreviewAnimation,
    setScrubTime,
  } = useEditor();
  const [elapsed, setElapsed] = useState(0);
  const [showCustomKeyframes, setShowCustomKeyframes] = useState(false);
  const [staggerStep, setStaggerStep] = useState(0.15);

  // Determine selection
  const hasMultiSelection = (selectedLayerIds?.length ?? 0) > 1;
  const selectedId =
    selectedLayerIds && selectedLayerIds.length === 1
      ? selectedLayerIds[0]
      : null;
  const selectedProps =
    selectedId && elementProperties ? elementProperties[selectedId] : null;
  const activeAnim: AnimationConfig | undefined = selectedProps?.animation;

  // Animations across the current selection — used for multi-layer preview/stagger.
  const selectionAnimations: AnimationConfig[] = (selectedLayerIds ?? [])
    .map((id) => elementProperties?.[id] as (ElementProperties & { animation?: AnimationConfig }) | undefined)
    .filter((p) => !!p?.animation)
    .map((p) => p!.animation!);
  const hasAnimatedSelection = selectionAnimations.length > 0;

  // Scan ALL layers for animation configs — used for document-wide preview +
  // timer so the no-selection view can still play everything.
  const docAnimations: AnimationConfig[] = Object.values(
    elementProperties ?? {},
  )
    .filter(
      (p): p is ElementProperties & { animation: AnimationConfig } =>
        !!p?.animation,
    )
    .map((p) => p.animation);
  const docHasAnimations = docAnimations.length > 0;

  // Auto-stop timer: use the longest animation across the whole document.
  const maxPreviewDuration = docAnimations.reduce((max, a) => {
    const total =
      a.iterationCount === "infinite"
        ? a.duration + a.delay
        : (a.duration + a.delay) * (a.iterationCount as number);
    return Math.max(max, total);
  }, 0);

  const updateProps = useCallback(
    (updates: Partial<ElementProperties>) => {
      if (!selectedId) return;
      setElementProperties((prev) => {
        const existing = prev[selectedId];
        if (!existing) return prev;
        return { ...prev, [selectedId]: { ...existing, ...updates } as ElementProperties };
      });
    },
    [selectedId, setElementProperties],
  );

  const applyPreset = useCallback(
    (presetName: string) => {
      const preset = ANIMATION_PRESETS[presetName];
      if (!preset) return;
      const full: AnimationConfig = {
        name: preset.defaults.name!,
        duration: preset.defaults.duration!,
        delay: preset.defaults.delay!,
        iterationCount: preset.defaults.iterationCount!,
        timingFunction: preset.defaults.timingFunction!,
        direction: preset.defaults.direction!,
        fillMode: preset.defaults.fillMode!,
      };
      updateProps({ animation: full });
    },
    [updateProps],
  );

  const removeAnimation = useCallback(() => {
    updateProps({ animation: undefined });
  }, [updateProps]);

  const updateAnimField = useCallback(
    (field: keyof AnimationConfig, value: unknown) => {
      if (!activeAnim) return;
      updateProps({
        animation: { ...activeAnim, [field]: value } as AnimationConfig,
      });
    },
    [activeAnim, updateProps],
  );

  // Bulk-apply animation to ALL selected layers
  const applyToAllSelected = useCallback(
    (presetName: string) => {
      const preset = ANIMATION_PRESETS[presetName];
      if (!preset || !selectedLayerIds || selectedLayerIds.length < 2) return;
      const anim: AnimationConfig = {
        name: preset.defaults.name!,
        duration: preset.defaults.duration!,
        delay: preset.defaults.delay!,
        iterationCount: preset.defaults.iterationCount!,
        timingFunction: preset.defaults.timingFunction!,
        direction: preset.defaults.direction!,
        fillMode: preset.defaults.fillMode!,
      };
      setElementProperties((prev) =>
        applyAnimationToLayers(selectedLayerIds, anim, prev),
      );
    },
    [selectedLayerIds, setElementProperties],
  );

  // Stagger: apply animation to all selected layers with staggered delays
  const applyStaggered = useCallback(
    (presetName: string) => {
      const preset = ANIMATION_PRESETS[presetName];
      if (!preset || !selectedLayerIds || selectedLayerIds.length < 2) return;
      const anim: AnimationConfig = {
        name: preset.defaults.name!,
        duration: preset.defaults.duration!,
        delay: 0,
        iterationCount: preset.defaults.iterationCount!,
        timingFunction: preset.defaults.timingFunction!,
        direction: preset.defaults.direction!,
        fillMode: preset.defaults.fillMode!,
      };
      setElementProperties((prev) =>
        applyStaggeredAnimation(selectedLayerIds, anim, 0, staggerStep, prev),
      );
    },
    [selectedLayerIds, staggerStep, setElementProperties],
  );

  // Animation preview timer — auto-stops after the longest animation in the
  // current selection finishes (single layer or staggered multi-layer preview).
  useEffect(() => {
    if (!previewAnimation || maxPreviewDuration <= 0) {
      // Reset the elapsed readout when preview ends; the raf loop below owns
      // the live updates.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(0);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const now = performance.now();
      const e = (now - start) / 1000;
      if (e >= maxPreviewDuration) {
        setElapsed(maxPreviewDuration);
        setPreviewAnimation(false);
        return;
      }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [previewAnimation, maxPreviewDuration, setPreviewAnimation]);

  // ── No usable selection (nothing selected, or a single group/empty layer) ─
  const noUsableSelection =
    !selectedLayerIds ||
    selectedLayerIds.length === 0 ||
    (selectedLayerIds.length === 1 && !selectedProps);
  if (noUsableSelection) {
    return (
      <div className="flex flex-col gap-0">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
              Animation
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            {docHasAnimations ? (
              <>
                <button
                  onClick={() => {
                    if (previewAnimation) {
                      setPreviewAnimation(false);
                    } else {
                      setScrubTime(null);
                      setPreviewAnimation(true);
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium transition-all ${
                    previewAnimation
                      ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                      : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20"
                  }`}
                >
                  {previewAnimation ? (
                    <><Pause className="w-4 h-4" /> Stop Preview</>
                  ) : (
                    <><Play className="w-4 h-4" /> Preview All ({docAnimations.length} layer{docAnimations.length !== 1 ? "s" : ""})</>
                  )}
                </button>
                <p className="text-[10px] text-zinc-500 text-center max-w-[220px]">
                  Plays the CSS @keyframe animations applied to every layer.
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-zinc-400" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300">No Layer Selected</h3>
                <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[200px]">
                  Select a layer to add CSS @keyframe animations exported inside the SVG.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Show presets even without selection for browsing */}
        <div className="p-5">
          <div className="text-[10px] text-zinc-500 font-mono mb-3 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-500"><path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z"/></svg> Available Presets
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ANIMATION_PRESETS).map(([key, preset]) => (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-white/5 bg-zinc-900/50 opacity-60"
              >
                <span className="text-xs text-zinc-400 font-medium">{preset.defaults.name}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">{preset.defaults.duration}s</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Multi-selection: stagger + bulk-apply animations ─────────────────────
  if (hasMultiSelection) {
    return (
      <div className="flex flex-col gap-0">
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
              Animation
            </div>
            <span className="text-[9px] text-zinc-600 font-mono">{selectedLayerIds.length} layers</span>
          </div>

          {/* Preview play/stop */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (previewAnimation) {
                  setPreviewAnimation(false);
                } else {
                  setScrubTime(null);
                  setPreviewAnimation(true);
                }
              }}
              disabled={!hasAnimatedSelection}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-medium transition-all ${
                previewAnimation
                  ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                  : hasAnimatedSelection
                    ? "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5"
              }`}
            >
              {previewAnimation ? (
                <><Pause className="w-3.5 h-3.5" /> Stop</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Preview</>
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Apply an animation to all {selectedLayerIds.length} selected layers,
            or stagger them so each layer starts a beat after the previous one.
          </p>
        </div>

        {/* Stagger */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
            <Layers className="w-3 h-3" />
            Stagger
            <span className="text-[9px] text-zinc-600 ml-auto">offset each layer</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Step</span>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={staggerStep}
              onChange={(e) => setStaggerStep(Number(e.target.value))}
              className="flex-1 h-1 accent-purple-500"
            />
            <span className="text-[10px] text-zinc-400 font-mono w-8 text-right">{staggerStep}s</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {["Fade In", "Slide Up", "Zoom In", "Bounce"].map((name) => (
              <button
                key={name}
                onClick={() => applyStaggered(name)}
                className="py-2 px-3 text-xs rounded-md transition-all text-purple-400 hover:text-purple-200 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10 flex items-center justify-center gap-1"
              >
                <Wand className="w-3 h-3" />
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Apply same animation to all */}
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Apply Same to All
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(ANIMATION_PRESETS).slice(0, 4).map((name) => (
              <button
                key={`all-${name}`}
                onClick={() => applyToAllSelected(name)}
                className="py-2 px-3 text-xs rounded-md transition-all text-zinc-400 hover:text-zinc-200 border border-white/5 hover:border-white/10 hover:bg-white/5 flex items-center justify-center gap-1"
              >
                <Layers className="w-3 h-3" />
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Active animation section ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold">
            Animation
          </div>
          {activeAnim && (
            <button
              onClick={removeAnimation}
              className="text-[10px] text-zinc-500 hover:text-red-400 font-mono uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>

        {/* Preview play/stop */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (previewAnimation) {
                setPreviewAnimation(false);
              } else {
                setScrubTime(null);
                setPreviewAnimation(true);
              }
            }}
            disabled={!activeAnim}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-medium transition-all ${
              previewAnimation
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                : activeAnim
                  ? "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5"
            }`}
          >
            {previewAnimation ? (
              <><Pause className="w-3.5 h-3.5" /> Stop</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Preview</>
            )}
          </button>
          {activeAnim && (
            <span className="text-[10px] text-zinc-500 font-mono">
              {activeAnim.name}
            </span>
          )}
        </div>

        {/* Timeline Editor with draggable playhead and keyframes */}
        {activeAnim && (
          <div className="mb-2">
            <TimelineEditor
              anim={activeAnim}
              elapsed={elapsed}
              timelineWidth={228}
              onScrubDrag={(t) => setScrubTime(t)}
              onScrubEnd={() => setScrubTime(null)}
              onKeyframeMove={(index, newPercent) => {
                const kfs = [...(activeAnim.keyframes || [{ percent: 0 }, { percent: 100 }])];
                kfs[index] = { ...kfs[index], percent: newPercent };
                kfs.sort((a, b) => a.percent - b.percent);
                updateAnimField("keyframes", kfs);
              }}
            />
          </div>
        )}
        {!activeAnim && (
          <div className="mb-2 mx-5">
            <div className="h-12 bg-zinc-800/30 rounded-md border border-white/5 flex items-center justify-center">
              <span className="text-[10px] text-zinc-600 font-mono">No animation applied</span>
            </div>
          </div>
        )}
      </div>


      {/* Presets */}
      <div className="p-5 border-b border-white/5">
        <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
          Presets
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.keys(ANIMATION_PRESETS).map((name) => {
            const isActive = activeAnim?.name === ANIMATION_PRESETS[name].defaults.name;
            return (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className={`py-2 px-3 text-xs rounded-md transition-all ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-zinc-400 hover:text-zinc-200 border border-white/5 hover:border-white/10 hover:bg-white/5"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom settings (only when an animation is active) */}
      {activeAnim && (
        <div className="p-5 border-b border-white/5">
          <div className="text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-3 font-semibold">
            Settings
          </div>
          <div className="flex flex-col gap-3">
            {/* Duration */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Duration</span>
              <input type="range" min={0.1} max={5} step={0.1} value={activeAnim.duration}
                onChange={(e) => updateAnimField("duration", Number(e.target.value))}
                className="flex-1 h-1 accent-blue-500" />
              <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">{activeAnim.duration}s</span>
            </div>
            {/* Delay */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Delay</span>
              <input type="range" min={0} max={3} step={0.1} value={activeAnim.delay}
                onChange={(e) => updateAnimField("delay", Number(e.target.value))}
                className="flex-1 h-1 accent-blue-500" />
              <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">{activeAnim.delay}s</span>
            </div>
            {/* Timing function + easing viz */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Easing</span>
              <select value={activeAnim.timingFunction}
                onChange={(e) => updateAnimField("timingFunction", e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
                <option value="ease">Ease</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In Out</option>
                <option value="linear">Linear</option>
                <option value="cubic-bezier(0.34,1.56,0.64,1)">Spring</option>
              </select>
            </div>
            {/* Easing curve visualizer */}
            <EasingViz easing={activeAnim.timingFunction} />
            {/* Iteration count */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Repeat</span>
              <select value={String(activeAnim.iterationCount)}
                onChange={(e) => { const v = e.target.value; updateAnimField("iterationCount", v === "infinite" ? "infinite" : Number(v)); }}
                className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="infinite">∞ Infinite</option>
              </select>
            </div>
            {/* Direction */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Direction</span>
              <select value={activeAnim.direction}
                onChange={(e) => updateAnimField("direction", e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
                <option value="normal">Normal</option>
                <option value="reverse">Reverse</option>
                <option value="alternate">Alternate</option>
                <option value="alternate-reverse">Alt Reverse</option>
              </select>
            </div>
            {/* Fill mode */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-14 shrink-0">Fill</span>
              <select value={activeAnim.fillMode}
                onChange={(e) => updateAnimField("fillMode", e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/5 rounded-md px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
                <option value="none">None</option>
                <option value="forwards">Forwards</option>
                <option value="backwards">Backwards</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          {/* Custom keyframe editor toggle */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <button
              onClick={() => setShowCustomKeyframes(!showCustomKeyframes)}
              className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-wider transition-colors"
            >
              {showCustomKeyframes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Custom Keyframes
              {activeAnim?.customKeyframes && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-1" />
              )}
            </button>
            {showCustomKeyframes && (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={activeAnim.customKeyframes ?? ""}
                  onChange={(e) => updateAnimField("customKeyframes", e.target.value || undefined)}
                  placeholder={`@keyframes ${activeAnim.name} {\n  0%   { /* from state */ }\n  100% { /* to state */ }\n}`}
                  rows={8}
                  spellCheck={false}
                  className="w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500/50 resize-y placeholder:text-zinc-600"
                />
                <p className="text-[9px] text-zinc-600 leading-relaxed">
                  Write raw @keyframes CSS. When set, this replaces the preset keyframes in the exported SVG.
                  Leave empty to use the built-in preset definition.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="p-5">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Animations are embedded as CSS <code className="text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded font-mono">@keyframes</code> inside the exported SVG's <code className="text-zinc-500 bg-zinc-900 px-1 py-0.5 rounded font-mono">&lt;style&gt;</code> block. GitHub and most markdown renderers display them natively.
        </p>
      </div>
    </div>
  );
}

export default AnimateTab;
