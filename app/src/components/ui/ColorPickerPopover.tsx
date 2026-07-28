import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  hexToHsb,
  hsbToHex,
  normalizeHex,
  isValidHex,
} from "../../lib/color";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorPickerPopoverProps {
  /** Current hex color (e.g. "#ff6600") */
  value: string;
  /** Called when user picks a color */
  onChange: (hex: string) => void;
}

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

  // ── Calculate popover position with collision detection ────────────────────
  // Matches open-pencil's PopoverPortal + side/offset + automatic flip behavior.
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverW = 224; // w-56
    const popoverH = 310; // approximate height
    const gap = 4;        // open-pencil's side-offset=4

    // Default: below trigger, right-aligned
    let top = rect.bottom + gap;
    let left = rect.right - popoverW;

    // Collision: if not enough space below, flip to top
    if (top + popoverH > window.innerHeight - 8) {
      const above = rect.top - gap - popoverH;
      if (above > 0 || rect.top > window.innerHeight / 2) {
        // Prefer above when more room above than below, or when below overflows
        top = above;
      }
    }

    // Collision: if left would overflow viewport, align to left edge
    if (left < 8) left = 8;
    if (left + popoverW > window.innerWidth - 8) {
      left = window.innerWidth - popoverW - 8;
    }

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
    // Position the popover after layout
    updatePosition();

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target)
      ) {
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

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // ── Internal picker state ──────────────────────────────────────────────────
  // We track h/s/b so the 2D area and slider stay snappy during drag.

  // Memoize the initial HSB so re-opening resets properly
  const initialHsb = hexToHsb(value);
  const [hue, setHue] = useState(initialHsb.h);
  const [sat, setSat] = useState(initialHsb.s);
  const [bri, setBri] = useState(initialHsb.b);
  const [hexInput, setHexInput] = useState(value);

  // Reset internal state when the popover opens
  useEffect(() => {
    if (isOpen) {
      const hsb = hexToHsb(value);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
      setHexInput(value);
    }
  }, [isOpen, value]);

  // Derive current hex from HSB (for preview while dragging)
  const previewHex = hsbToHex(hue, sat, bri);

  // ── Commit the current color to parent ─────────────────────────────────────
  const commitColor = useCallback(
    (hex: string) => {
      const n = normalizeHex(hex);
      if (n) onChange(n);
    },
    [onChange],
  );

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
        // Commit on drag end
        commitColor(hsbToHex(hue, sat, bri));
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateFromArea, commitColor, hue, sat, bri],
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
        commitColor(hsbToHex(hue, sat, bri));
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [updateFromHueSlider, commitColor, hue, sat, bri],
  );

  // ── Preset click ───────────────────────────────────────────────────────────
  const handlePresetClick = useCallback(
    (hex: string) => {
      onChange(hex);
      setIsOpen(false);
    },
    [onChange],
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
      commitColor(n);
      setHexInput(n);
    } else {
      // Revert to the current valid color
      setHexInput(value);
    }
  }, [hexInput, commitColor, value]);

  const handleHexInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const n = normalizeHex(hexInput);
        if (n) {
          onChange(n);
          setIsOpen(false);
        }
      }
    },
    [hexInput, onChange],
  );

  // ── Trigger click ──────────────────────────────────────────────────────────
  const handleTriggerClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

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

  return (
    <div className="relative inline-block">
      {/* ── Trigger ──────────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-md p-3 w-full hover:border-white/10 transition-all cursor-pointer text-left"
        style={{ minWidth: 0 }}
      >
        <span
          className="w-6 h-6 rounded border border-white/10 shrink-0"
          style={{ background: value }}
        />
        <span className="text-[10px] text-zinc-500 uppercase font-mono">
          {value}
        </span>
      </button>

      {/* ── Popover (portal to body — like open-pencil's PopoverPortal) ──────────── */}
      {isOpen && document.body && createPortal(
        <div
          ref={containerRef}
          style={popoverStyle}
          className="w-56 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl p-3 flex flex-col gap-3 z-[99999]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Preview bar */}
          <div
            className="h-8 rounded-md border border-white/10"
            style={{ background: previewHex }}
          />

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
              className="relative h-32 w-full rounded-md cursor-crosshair overflow-hidden border border-white/10"
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
              className="relative h-3 w-full rounded-full cursor-pointer"
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
            />
          </div>
        </div>
      , document.body)}
    </div>
  );
}
