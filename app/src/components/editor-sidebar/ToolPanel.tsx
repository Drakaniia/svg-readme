import { useState, useEffect, useRef } from "react";
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  PenTool,
  Maximize,
  MousePointer2,
  Triangle,
  Star,
  Hexagon,
  Slash,
  Shapes,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import type { EditorTool } from "../../context/EditorContext";

// ─── Tool & Shape Definitions ─────────────────────────────────────────────────

const tools: { id: EditorTool | "shapes"; icon: React.ReactNode; name: string }[] = [
  { id: "move", icon: <MousePointer2 className="w-4 h-4" />, name: "Move" },
  { id: "pen", icon: <PenTool className="w-4 h-4" />, name: "Pen" },
  { id: "frame", icon: <Maximize className="w-4 h-4" />, name: "Frame" },
  { id: "shapes", icon: <Shapes className="w-4 h-4" />, name: "Shapes" },
  { id: "text", icon: <Type className="w-4 h-4" />, name: "Text" },
  { id: "image", icon: <ImageIcon className="w-4 h-4" />, name: "Image" },
];

export const availableShapes: { id: EditorTool; name: string; icon: React.ReactNode }[] = [
  { id: "rect", name: "Rectangle", icon: <Square className="w-4 h-4" /> },
  { id: "circle", name: "Circle", icon: <Circle className="w-4 h-4" /> },
  { id: "triangle", name: "Triangle", icon: <Triangle className="w-4 h-4" /> },
  { id: "star", name: "Star", icon: <Star className="w-4 h-4" /> },
  { id: "hexagon", name: "Hexagon", icon: <Hexagon className="w-4 h-4" /> },
  { id: "line", name: "Line", icon: <Slash className="w-4 h-4" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ToolPanelProps {
  /** Forwarded from EditorLayout → parent → here so text commits happen first */
  onToolSelect?: (tool: EditorTool) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToolPanel({ onToolSelect }: ToolPanelProps) {
  const { activeTool } = useEditor();
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const shapeButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectorRef = useRef<HTMLDivElement | null>(null);

  // ── Click outside handler for shape selector ──────────────────────────────
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        showShapeSelector &&
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node) &&
        shapeButtonRef.current &&
        !shapeButtonRef.current.contains(e.target as Node)
      ) {
        setShowShapeSelector(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showShapeSelector]);

  // ── Handle toolbar button click ───────────────────────────────────────────
  const handleToolClick = (toolId: EditorTool | "shapes") => {
    if (toolId === "shapes") {
      setShowShapeSelector((prev) => !prev);
      return;
    }
    setShowShapeSelector(false);
    // Route through the parent handler so text commits happen first (main's pattern)
    onToolSelect?.(toolId);
  };

  // ── Shape option selected from dropdown ───────────────────────────────────
  const handleShapeSelect = (shapeId: EditorTool) => {
    setShowShapeSelector(false);
    onToolSelect?.(shapeId);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 border-b border-white/5">
      <div className="grid grid-cols-4 gap-2 relative">
        {tools.map((tool) => {
          const isShapes = tool.id === "shapes";
          const isActive = isShapes
            ? showShapeSelector ||
              activeTool === "rect" ||
              activeTool === "circle" ||
              activeTool === "triangle" ||
              activeTool === "star" ||
              activeTool === "hexagon" ||
              activeTool === "line"
            : activeTool === tool.id;

          const buttonElement = (
            <button
              key={tool.id}
              ref={isShapes ? shapeButtonRef : undefined}
              onClick={() => handleToolClick(tool.id)}
              title={tool.name}
              className={`p-2.5 rounded-md flex items-center justify-center transition-all w-full ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              }`}
            >
              {tool.icon}
            </button>
          );

          if (isShapes) {
            return (
              <div key={tool.id} className="relative">
                {buttonElement}
                {showShapeSelector && (
                  <div
                    ref={selectorRef}
                    className="absolute left-0 mt-2 w-48 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl p-1.5 z-50 flex flex-col gap-0.5"
                  >
                    <div className="px-2 py-1.5 text-[10px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider font-semibold border-b border-white/5 mb-1 select-none">
                      Choose Shape
                    </div>
                    {availableShapes.map((shape) => (
                      <button
                        key={shape.name}
                        onClick={() => handleShapeSelect(shape.id)}
                        className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-md transition-colors text-left"
                      >
                        <span className="text-zinc-400 shrink-0">{shape.icon}</span>
                        <span className="font-medium">{shape.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return buttonElement;
        })}
      </div>
    </div>
  );
}
