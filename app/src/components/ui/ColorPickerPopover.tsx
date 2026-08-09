import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  hexToHsb,
  hsbToHex,
  normalizeHex,
  isValidHex,
  hexToRgb,
  hexToHsl,
  hexToRgba,
  rgbToHex,
  hslToHex,
} from "../../lib/color";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorPickerPopoverProps {
  /** Current hex color ("#rrggbb" or "#rrggbbaa") */
  value: string;
  /** Called when user picks a color */
  onChange: (hex: string) => void;
}

type ColorFormat = "rgb" | "hsl" | "hsb";

// ─── Preset palette (like open-pencil's swatch grid but simpler) ────────────────
// A curated set of colors useful for SVG banners on dark backgrounds.

const PRESET_COLORS = [
  "#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6",
  "#ff6b6b", "#f06595", "#cc5de8", "#845ef7",
  "#5c7cfa", "#339af0", "#22b8cf", "#20c997",
  "#51cf66", "#94d82d", "#fcc419", "#ff922b",
  "#868e96", "#495057", "#343a40", "#212529",
];

// ─── Hue slider stops (rainbow gradient) ──────────────────────────────────────

const HUE_STOPS = [
  "hsl(0,100%,50%)",
  "hsl(60,100%,50%)",
  "hsl(120,100%,50%)",
  "hsl(180,100%,50%)",
  "hsl(240,100%,50%)",
  "hsl(300,100%,50%)",
  "hsl(360,100%,50%)",
];

// ─── Transparency checkerboard (matches open-pencil's CHECKERBOARD_BACKGROUND) ─

const CHECKERBOARD =
  "conic-gradient(#3f3f46 25%, #1c1c1f 0 50%, #3f3f46 0 75%, #1c1c1f 0) 0 0 / 10px 10px";

// ─── Panel content ─────────────────────────────────────────────────────────────
// Mounted only while the popover is open, so state initializes from `value`
// on every open (open-pencil: ColorPickerRoot renders ColorPickerPanel).

function ColorPickerPanel({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ColorFormat>("hsb");

  // Snapshot the color at open time so Escape can cancel the whole session
  // (open-pencil: escape-key-down → cancel; commit happens on close).
  const openValueRef = useRef(value);

  const [hue, setHue] = useState(hexToHsb(value).h);
  const [sat, setSat] = useState(hexToHsb(value).s);
  const [bri, setBri] = useState(hexToHsb(value).b);
  const [alpha, setAlpha] = useState(hexToRgba(value).a);
  const [hexInput, setHexInput] = useState(value.slice(0, 7));

  // Live ref of the latest HSBA values so drag-end commits use the final
  // drag position, not the values captured at mousedown.
  const hsbaRef = useRef({ hue, sat, bri, alpha });
  useEffect(() => {
    hsbaRef.current = { hue, sat, bri, alpha };
  }, [hue, sat, bri, alpha]);

  // Derive current hex from HSB (for preview while dragging)
  const previewHex = hsbToHex(hue, sat, bri, alpha);

  // ── Commit helpers ─────────────────────────────────────────────────────────
  const commitColor = useCallback(
    (hex: string) => {
      const n = normalizeHex(hex);
      if (n) onChange(n);
    },
    [onChange],
  );

  const commitCurrent = useCallback(() => {
    const { hue: h, sat: s, bri: b, alpha: a } = hsbaRef.current;
    commitColor(hsbToHex(h, s, b, a));
  }, [commitColor]);

  // ── Color area (2D sat/brightness) ─────────────────────────────────────────
  const areaRef = useRef<HTMLDivElement>(null);
  const isDraggingArea = useRef(false);

  const updateFromArea = useCallback((clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setSat(Math.round(x * 100));
    setBri(Math.round((1 - y) * 100));
  }, []);

  // Keyboard support for the 2D area: arrows adjust saturation/brightness
  const handleAreaKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      const apply = (nextSat: number, nextBri: number) => {
        setSat(nextSat);
        setBri(nextBri);
        commitColor(hsbToHex(hue, nextSat, nextBri, alpha));
      };
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        apply(Math.max(0, sat - step), bri);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        apply(Math.min(100, sat + step), bri);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        apply(sat, Math.min(100, bri + step));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        apply(sat, Math.max(0, bri - step));
      }
    },
    [sat, bri, hue, alpha, commitColor],
  );

  const handleAreaMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingArea.current = true;
      updateFromArea(e.clientX, e.clientY);

      const handleMove = (ev: MouseEvent) => {
        if (isDraggingArea.current) updateFromArea(ev.clientX, ev.clientY);
      };
      const handleUp = () => {
        isDraggingArea.current = false;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        // Commit on drag end using the latest values
        commitCurrent();
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateFromArea, commitCurrent],
  );

  // ── Hue slider ─────────────────────────────────────────────────────────────
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingHue = useRef(false);

  const updateFromHueSlider = useCallback((clientX: number) => {
    const el = hueSliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHue(Math.round(x * 360));
  }, []);

  const handleHueKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = (hue - step + 360) % 360;
        setHue(next);
        commitColor(hsbToHex(next, sat, bri, alpha));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (hue + step) % 360;
        setHue(next);
        commitColor(hsbToHex(next, sat, bri, alpha));
      }
    },
    [hue, sat, bri, alpha, commitColor],
  );

  const handleHueMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingHue.current = true;
      updateFromHueSlider(e.clientX);

      const handleMove = (ev: MouseEvent) => {
        if (isDraggingHue.current) updateFromHueSlider(ev.clientX);
      };
      const handleUp = () => {
        isDraggingHue.current = false;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        commitCurrent();
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateFromHueSlider, commitCurrent],
  );

  // ── Alpha slider (checkerboard, like open-pencil's Alpha slider) ───────────
  const alphaSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingAlpha = useRef(false);

  const updateFromAlphaSlider = useCallback((clientX: number) => {
    const el = alphaSliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setAlpha(Math.round(x * 100));
  }, []);

  const handleAlphaKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = Math.max(0, alpha - step);
        setAlpha(next);
        commitColor(hsbToHex(hue, sat, bri, next));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = Math.min(100, alpha + step);
        setAlpha(next);
        commitColor(hsbToHex(hue, sat, bri, next));
      }
    },
    [hue, sat, bri, alpha, commitColor],
  );

  const handleAlphaMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingAlpha.current = true;
      updateFromAlphaSlider(e.clientX);

      const handleMove = (ev: MouseEvent) => {
        if (isDraggingAlpha.current) updateFromAlphaSlider(ev.clientX);
      };
      const handleUp = () => {
        isDraggingAlpha.current = false;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        commitCurrent();
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateFromAlphaSlider, commitCurrent],
  );

  // ── Preset click ───────────────────────────────────────────────────────────
  const handlePresetClick = useCallback(
    (hex: string) => {
      onChange(hex);
      onClose();
    },
    [onChange, onClose],
  );

  // ── Hex input ──────────────────────────────────────────────────────────────
  const handleHexInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setHexInput(raw);
      if (isValidHex(raw)) {
        const n = normalizeHex(raw);
        if (n) {
          const hsb = hexToHsb(n);
          setHue(hsb.h);
          setSat(hsb.s);
          setBri(hsb.b);
        }
      }
    },
    [],
  );

  const handleHexInputBlur = useCallback(() => {
    const n = normalizeHex(hexInput);
    if (n) {
      const { r, g, b } = hexToRgb(n);
      commitColor(rgbToHex(r, g, b, alpha));
      setHexInput(n.slice(0, 7));
    } else {
      // Revert to the current valid color
      setHexInput(value.slice(0, 7));
    }
  }, [hexInput, commitColor, alpha, value]);

  const handleHexInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const n = normalizeHex(hexInput);
        if (n) {
          const { r, g, b } = hexToRgb(n);
          onChange(rgbToHex(r, g, b, alpha));
          onClose();
        }
      }
    },
    [hexInput, onChange, alpha, onClose],
  );

  // ── Format channel fields (open-pencil: FormatControls) ────────────────────
  const channelFields = (() => {
    if (format === "rgb") {
      const { r, g, b } = hexToRgb(previewHex);
      return [
        { label: "R", value: r, max: 255 },
        { label: "G", value: g, max: 255 },
        { label: "B", value: b, max: 255 },
      ];
    }
    if (format === "hsl") {
      const { h, s, l } = hexToHsl(previewHex);
      return [
        { label: "H", value: h, max: 360 },
        { label: "S", value: s, max: 100 },
        { label: "L", value: l, max: 100 },
      ];
    }
    return [
      { label: "H", value: hue, max: 360 },
      { label: "S", value: sat, max: 100 },
      { label: "B", value: bri, max: 100 },
    ];
  })();

  const handleChannelChange = useCallback(
    (index: number, raw: string) => {
      const v = Math.max(0, Math.min(channelFields[index].max, Number(raw) || 0));
      if (format === "rgb") {
        const { r, g, b } = hexToRgb(previewHex);
        const next = [r, g, b];
        next[index] = v;
        const hsb = hexToHsb(rgbToHex(next[0], next[1], next[2], alpha));
        setHue(hsb.h);
        setSat(hsb.s);
        setBri(hsb.b);
      } else if (format === "hsl") {
        const { h, s, l } = hexToHsl(previewHex);
        const next = [h, s, l];
        next[index] = v;
        const hsb = hexToHsb(hslToHex(next[0], next[1], next[2]));
        setHue(hsb.h);
        setSat(hsb.s);
        setBri(hsb.b);
      } else {
        const next = [hue, sat, bri];
        next[index] = v;
        setHue(next[0]);
        setSat(next[1]);
        setBri(next[2]);
      }
    },
    [format, previewHex, channelFields, alpha, hue, sat, bri],
  );

  const handleChannelBlur = useCallback(() => {
    commitColor(previewHex);
  }, [commitColor, previewHex]);

  // ── Escape = cancel (revert to the color at open time, then close) ─────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Only emit a revert when something actually changed during this session
        if (openValueRef.current && previewHex !== openValueRef.current) {
          onChange(openValueRef.current);
        }
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onChange, onClose, previewHex]);

  // ── Color area background gradient ─────────────────────────────────────────
  const areaBackground = `
    linear-gradient(to top, #000, transparent),
    linear-gradient(to left, ${hsbToHex(hue, 100, 100)}, #fff)
  `;

  // Hue slider thumb position
  const hueThumbLeft = `${(hue / 360) * 100}%`;

  // Area thumb position
  const areaThumbLeft = `${sat}%`;
  const areaThumbTop = `${100 - bri}%`;

  // Alpha slider thumb + gradient
  const alphaThumbLeft = `${alpha}%`;
  const solidHex = hsbToHex(hue, sat, bri);
  const alphaGradient = `linear-gradient(to right, transparent, ${solidHex})`;

  // Preview bar (checkerboard + rgba overlay)
  const rgba = hexToRgba(previewHex);
  const previewRgba = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha / 100})`;

  return (
    <>
      {/* Preview bar (checkerboard underlay when transparent) */}
      <div
        className="h-8 rounded-md border border-white/10 overflow-hidden relative"
        style={{ background: CHECKERBOARD }}
      >
        <div
          className="absolute inset-0 transition-colors"
          style={{ background: previewRgba }}
        />
      </div>

      {/* Preset palette grid — like open-pencil's swatches */}
      <div className="grid grid-cols-10 gap-1.5">
        {PRESET_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => handlePresetClick(hex)}
            className="w-4 h-4 rounded-sm border border-white/10 cursor-pointer hover:scale-125 transition-transform shrink-0"
            style={{ background: hex }}
            title={hex}
          />
        ))}
      </div>

      {/* Sat/Brightness 2D area */}
      <div>
        <div
          ref={areaRef}
          onMouseDown={handleAreaMouseDown}
          onKeyDown={handleAreaKeyDown}
          role="slider"
          aria-label="Saturation and brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((sat + bri) / 2)}
          aria-valuetext={`Saturation ${sat}%, brightness ${bri}%`}
          tabIndex={0}
          className="relative h-[140px] w-full rounded-md cursor-crosshair overflow-hidden border border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/60 outline-none"
          style={{ background: areaBackground }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              left: areaThumbLeft,
              top: areaThumbTop,
              width: 10,
              height: 10,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-md" />
          </div>
        </div>
      </div>

      {/* Hue slider */}
      <div>
        <div
          ref={hueSliderRef}
          onMouseDown={handleHueMouseDown}
          onKeyDown={handleHueKeyDown}
          role="slider"
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={hue}
          tabIndex={0}
          className="relative h-3 w-full rounded-full cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/60 outline-none"
          style={{
            background: `linear-gradient(to right, ${HUE_STOPS.join(", ")})`,
          }}
        >
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{
              left: hueThumbLeft,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="w-3 h-3 rounded-full border-2 border-white shadow-md bg-transparent" />
          </div>
        </div>
      </div>

      {/* Alpha slider (checkerboard) */}
      <div>
        <div
          ref={alphaSliderRef}
          onMouseDown={handleAlphaMouseDown}
          onKeyDown={handleAlphaKeyDown}
          role="slider"
          aria-label="Alpha"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={alpha}
          tabIndex={0}
          className="relative h-3 w-full rounded-full cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-blue-500/60 outline-none"
          style={{ background: CHECKERBOARD }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: alphaGradient }}
          />
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{
              left: alphaThumbLeft,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-md"
              style={{ background: solidHex }}
            />
          </div>
        </div>
      </div>

      {/* Format controls (like open-pencil's FormatControls) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ColorFormat)}
            className="bg-black/20 border border-white/5 rounded-md px-1.5 py-1 text-[10px] font-mono text-zinc-400 outline-none focus:border-blue-500/50 cursor-pointer appearance-none"
            aria-label="Color format"
          >
            <option value="rgb">RGB</option>
            <option value="hsl">HSL</option>
            <option value="hsb">HSB</option>
          </select>
          <span className="flex-1" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            A:{alpha}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-white/5 bg-white/5">
          {channelFields.map((field, i) => (
            <div key={field.label} className="relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-500 pointer-events-none">
                {field.label}
              </span>
              <input
                type="number"
                value={field.value}
                min={0}
                max={field.max}
                onChange={(e) => handleChannelChange(i, e.target.value)}
                onBlur={handleChannelBlur}
                className="w-full bg-black/20 py-1 pl-4 pr-1 text-[11px] font-mono text-zinc-300 outline-none focus:bg-black/40"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-md px-2 py-1.5 focus-within:border-blue-500/50 transition-all">
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
          Hex
        </span>
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInputChange}
          onBlur={handleHexInputBlur}
          onKeyDown={handleHexInputKeyDown}
          className="bg-transparent text-xs font-mono text-zinc-300 w-full outline-none"
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
        />
      </div>
    </>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ColorPickerPopover({
  value,
  onChange,
}: ColorPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    position: "fixed",
    zIndex: 99999,
    visibility: "hidden", // hidden until position is calculated
  });

  // ── Popover positioning (like open-pencil's Popover: side="left", offset 4, flip) ──
  // Measures the actual content so the flip logic stays correct as the panel grows.
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    const pop = containerRef.current;
    if (!el || !pop) return;
    const rect = el.getBoundingClientRect();
    const popoverW = pop.offsetWidth;
    const popoverH = pop.offsetHeight;
    const gap = 4; // open-pencil's side-offset=4

    // Preferred side: left of the trigger, vertically centered
    let left = rect.left - gap - popoverW;
    let top = rect.top + rect.height / 2 - popoverH / 2;

    // Flip to the right if there's no room on the left
    if (left < 8) left = rect.right + gap;
    // Clamp horizontally
    if (left + popoverW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popoverW - 8);
    }
    // Clamp vertically
    top = Math.max(8, Math.min(top, window.innerHeight - popoverH - 8));

    setPopoverStyle({
      position: "fixed",
      top,
      left,
      zIndex: 99999,
      visibility: "visible",
    });
  }, []);

  // Close on click outside (portal-aware: check both trigger and portal content)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) {
        return; // Click on trigger is handled by toggle
      }
      // Check if click is inside the portal content
      if (containerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    // Delay so the trigger click doesn't immediately close
    const id = setTimeout(() =>
      document.addEventListener("mousedown", handleOutsideClick),
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, updatePosition]);

  // Reposition on scroll/resize (and when the format switch changes panel height)
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Position after layout settles (fonts, initial render). Also re-runs on
  // every open since the panel content is freshly mounted.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(updatePosition, 0);
    return () => clearTimeout(t);
  }, [isOpen, updatePosition]);

  // ── Trigger click ──────────────────────────────────────────────────────────
  const handleTriggerClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="relative inline-block w-full">
      {/* ── Trigger: compact swatch + hex (like open-pencil's ColorInput) ─────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className="flex w-full items-center gap-2.5 rounded-md border border-white/5 bg-zinc-900 px-3 py-2.5 text-left hover:border-white/10 transition-all cursor-pointer"
        style={{ minWidth: 0 }}
      >
        <span
          className="h-5 w-5 shrink-0 rounded border border-white/10"
          style={{ background: value }}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">
          {value}
        </span>
      </button>

      {/* ── Popover (portal to body — like open-pencil's PopoverPortal) ──────────── */}
      {isOpen && document.body && createPortal(
        <div
          ref={containerRef}
          style={popoverStyle}
          className="w-60 bg-zinc-900 border border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-3 flex flex-col gap-2.5 z-[99999] max-h-[calc(100vh-16px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ColorPickerPanel
            value={value}
            onChange={onChange}
            onClose={() => setIsOpen(false)}
          />
        </div>
      , document.body)}
    </div>
  );
}
