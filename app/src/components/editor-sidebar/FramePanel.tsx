import { ArrowsOut, Monitor, DeviceMobile, DeviceTablet } from "@phosphor-icons/react";

export type FrameSize = {
  width: number;
  height: number;
};

interface FramePanelProps {
  frameSize: FrameSize;
  setFrameSize: (size: FrameSize) => void;
}

const PRESETS = [
  {
    name: "Banner",
    width: 700,
    height: 350,
    icon: <Monitor className="w-3.5 h-3.5" />,
  },
  {
    name: "Square",
    width: 500,
    height: 500,
    icon: <DeviceTablet className="w-3.5 h-3.5" />,
  },
  {
    name: "Mobile",
    width: 390,
    height: 844,
    icon: <DeviceMobile className="w-3.5 h-3.5" />,
  },
];

export default function FramePanel({
  frameSize,
  setFrameSize,
}: FramePanelProps) {
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setFrameSize({ ...frameSize, width: val });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setFrameSize({ ...frameSize, height: val });
  };

  return (
    <div className="border-b border-white/5 flex flex-col shrink-0">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase font-semibold tracking-wider">
          <ArrowsOut className="w-3.5 h-3.5" />
          Frame
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 font-mono uppercase">
              Width
            </label>
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-md px-2 py-1.5 focus-within:border-blue-500/50 transition-colors">
              <span className="text-zinc-500 text-xs font-mono">W</span>
              <input
                type="number"
                value={frameSize.width}
                onChange={handleWidthChange}
                className="bg-transparent text-sm w-full outline-none text-zinc-300 font-mono"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 font-mono uppercase">
              Height
            </label>
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-md px-2 py-1.5 focus-within:border-blue-500/50 transition-colors">
              <span className="text-zinc-500 text-xs font-mono">H</span>
              <input
                type="number"
                value={frameSize.height}
                onChange={handleHeightChange}
                className="bg-transparent text-sm w-full outline-none text-zinc-300 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-0.5">
            Presets
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() =>
                  setFrameSize({ width: preset.width, height: preset.height })
                }
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-md bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 text-zinc-400 hover:text-zinc-200 transition-all group"
                title={`${preset.width}x${preset.height}`}
              >
                {preset.icon}
                <span className="text-[9px] font-medium truncate w-full text-center group-hover:text-zinc-100">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
