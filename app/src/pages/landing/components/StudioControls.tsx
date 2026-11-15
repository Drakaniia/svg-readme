import type { ReactNode } from "react";
import { ArrowCounterClockwise, Shuffle } from "@phosphor-icons/react";
import { QUICK_SWATCHES, QUICK_FONTS, QUICK_MOTIONS } from "../lib/quickBanner";
import type { QuickMotion, QuickTheme, QuickFont } from "../lib/quickBanner";

interface Props {
  handle: string;
  tagline: string;
  color: string;
  motion: QuickMotion;
  size: string;
  theme: QuickTheme;
  font: QuickFont;
  gradient: boolean;
  onHandle: (v: string) => void;
  onTagline: (v: string) => void;
  onColor: (v: string) => void;
  onMotion: (v: QuickMotion) => void;
  onSize: (v: string) => void;
  onTheme: (v: QuickTheme) => void;
  onFont: (v: QuickFont) => void;
  onGradient: (v: boolean) => void;
  onRandomize: () => void;
  onReset: () => void;
}

const motionCls = "transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-brand";

const inputCls = `w-full px-3 py-2 border border-zinc-200 body-6 text-zinc-900 bg-white outline-none ${motionCls} hover:border-zinc-300 focus:border-[#1b5def] focus:shadow-[0_0_0_3px_rgba(27,93,239,0.15)]`;

function toggleBtn(active: boolean) {
  return `focus-ring flex-1 px-2 py-2 button-xsm ${motionCls} active:scale-[0.98] ${
    active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
  }`;
}

function Group({ n, label, id, children }: { n: string; label: string; id?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div id={id} className="flex items-center gap-2 caption-3 uppercase tracking-wider text-zinc-500">
        <span className="text-[#1b5def]">{n}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <div className={`caption-5 text-right mt-1 ${value >= max ? "text-amber-700" : "text-zinc-500"}`}>
      {value}/{max}
    </div>
  );
}

export default function StudioControls(p: Props) {
  return (
    <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200 bg-white flex flex-col gap-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={p.onRandomize}
          className={`focus-ring flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 button-sm bg-zinc-900 text-white hover:bg-zinc-700 active:scale-[0.98] ${motionCls}`}
        >
          <Shuffle size={16} weight="bold" aria-hidden="true" />
          Shuffle
        </button>
        <button
          type="button"
          onClick={p.onReset}
          className={`focus-ring flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 button-sm border border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.98] ${motionCls}`}
        >
          <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
          Reset
        </button>
      </div>

      <Group n="01" label="Content">
        <div>
          <label htmlFor="quick-handle" className="block caption-1 text-zinc-700 mb-2">
            Name or handle
          </label>
          <input
            id="quick-handle"
            className={inputCls}
            type="text"
            value={p.handle}
            onChange={(e) => p.onHandle(e.target.value)}
            maxLength={28}
            placeholder="Your name or handle"
          />
          <Counter value={p.handle.length} max={28} />
        </div>
        <div>
          <label htmlFor="quick-tagline" className="block caption-1 text-zinc-700 mb-2">
            Tagline
          </label>
          <input
            id="quick-tagline"
            className={inputCls}
            type="text"
            value={p.tagline}
            onChange={(e) => p.onTagline(e.target.value)}
            maxLength={60}
            placeholder="What you build, in one line"
          />
          <Counter value={p.tagline.length} max={60} />
        </div>
      </Group>

      <Group n="02" label="Accent color" id="quick-accent-label">
        <div className="flex gap-3 flex-wrap items-center" role="group" aria-labelledby="quick-accent-label">
          {QUICK_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-label={s.name}
              aria-pressed={p.color === s.value}
              title={s.name}
              className={`focus-ring w-8 h-8 border-2 cursor-pointer hover:scale-110 active:scale-[0.98] ${motionCls} ${
                p.color === s.value
                  ? "border-zinc-900 shadow-[0_0_0_2px_white,0_0_0_4px_#18181b]"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: s.value }}
              onClick={() => p.onColor(s.value)}
            />
          ))}
          <label
            className={`w-8 h-8 border-2 border-dashed border-zinc-300 cursor-pointer relative overflow-hidden hover:border-zinc-900 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1b5def] ${motionCls}`}
            title="Custom color"
          >
            <span className="sr-only">Custom color</span>
            <input
              type="color"
              aria-label="Custom accent color"
              className="absolute inset-0 w-full h-full cursor-pointer p-0 border-0"
              value={/^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#1b5def"}
              onChange={(e) => p.onColor(e.target.value)}
            />
          </label>
        </div>
      </Group>

      <Group n="03" label="Typography">
        <label htmlFor="quick-font" className="sr-only">
          Font
        </label>
        <select
          id="quick-font"
          className={inputCls}
          value={p.font}
          onChange={(e) => p.onFont(e.target.value as QuickFont)}
        >
          {QUICK_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.stack.split(",")[0].replace(/'/g, "")})
            </option>
          ))}
        </select>
      </Group>

      <Group n="04" label="Motion" id="quick-motion-label">
        <div className="grid grid-cols-2 bg-zinc-100 p-1 gap-1" role="group" aria-labelledby="quick-motion-label">
          {QUICK_MOTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={p.motion === m.id}
              className={toggleBtn(p.motion === m.id)}
              onClick={() => p.onMotion(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </Group>

      <Group n="05" label="Style">
        <div className="flex bg-zinc-100 p-1 gap-1" role="group" aria-label="Theme">
          <button
            type="button"
            aria-pressed={p.theme === "light"}
            className={toggleBtn(p.theme === "light")}
            onClick={() => p.onTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            aria-pressed={p.theme === "dark"}
            className={toggleBtn(p.theme === "dark")}
            onClick={() => p.onTheme("dark")}
          >
            Dark
          </button>
        </div>
        <label className="flex items-center gap-2 body-6 text-zinc-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={p.gradient}
            onChange={(e) => p.onGradient(e.target.checked)}
            className="focus-ring w-4 h-4 accent-[#1b5def]"
          />
          Accent gradient wash
        </label>
      </Group>

      <Group n="06" label="Size">
        <label htmlFor="quick-size" className="sr-only">
          Banner size
        </label>
        <select
          id="quick-size"
          className={inputCls}
          value={p.size}
          onChange={(e) => p.onSize(e.target.value)}
        >
          <option value="800x200">800 × 200, standard</option>
          <option value="1000x220">1000 × 220, wide</option>
          <option value="640x160">640 × 160, compact</option>
        </select>
      </Group>
    </div>
  );
}
