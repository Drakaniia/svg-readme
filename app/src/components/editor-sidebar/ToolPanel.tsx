import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  PenTool,
  MousePointer2,
  Hand,
  Triangle,
  Star,
  Hexagon,
  Slash,
  PaintBucket,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import type { EditorTool } from "../../context/EditorContext";
import ColorPickerPopover from "../ui/ColorPickerPopover";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const tools: { id: EditorTool; icon: React.ReactNode; name: string; shortcut?: string }[] = [
  { id: "move", icon: <MousePointer2 className="w-4 h-4" />, name: "Move", shortcut: "V" },
  { id: "hand", icon: <Hand className="w-4 h-4" />, name: "Hand", shortcut: "H" },
  { id: "pen", icon: <PenTool className="w-4 h-4" />, name: "Pen", shortcut: "P" },
  { id: "rect", icon: <Square className="w-4 h-4" />, name: "Rectangle", shortcut: "R" },
  { id: "circle", icon: <Circle className="w-4 h-4" />, name: "Circle", shortcut: "O" },
  { id: "triangle", icon: <Triangle className="w-4 h-4" />, name: "Triangle" },
  { id: "star", icon: <Star className="w-4 h-4" />, name: "Star" },
  { id: "hexagon", icon: <Hexagon className="w-4 h-4" />, name: "Hexagon" },
  { id: "line", icon: <Slash className="w-4 h-4" />, name: "Line", shortcut: "L" },
  { id: "text", icon: <Type className="w-4 h-4" />, name: "Text", shortcut: "T" },
  { id: "image", icon: <ImageIcon className="w-4 h-4" />, name: "Image" },
  { id: "paint", icon: <PaintBucket className="w-4 h-4" />, name: "Paint Bucket" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ToolPanelProps {
  onToolSelect?: (tool: EditorTool) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToolPanel({ onToolSelect }: ToolPanelProps) {
  const { activeTool, paintColor, setPaintColor } = useEditor();

  return (
    <div className="p-4 border-b border-white/5">
      <div className="grid grid-cols-4 gap-2">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolSelect?.(tool.id)}
              title={tool.shortcut ? `${tool.name} (${tool.shortcut})` : tool.name}
              aria-pressed={isActive}
              aria-label={tool.name}
              className={`p-2.5 rounded-md flex items-center justify-center transition-all w-full ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              }`}
            >
              {tool.icon}
            </button>
          );
        })}
      </div>

      {/* Paint bucket color chooser — only shown while the tool is active */}
      {activeTool === "paint" && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[11px] font-medium text-zinc-300 uppercase tracking-wider">
              Paint Color
            </span>
          </div>
          <ColorPickerPopover value={paintColor} onChange={setPaintColor} />
        </div>
      )}
    </div>
  );
}
