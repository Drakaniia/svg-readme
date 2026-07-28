import { ArrowLeft, Save, Download, MousePointer2, Type, FilePlus2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEditor, type EditorTool } from "../../context/EditorContext";

interface EditorTopNavProps {
  onToolSelect?: (tool: EditorTool) => void;
  onExport?: () => void;
  onNewProject?: () => void;
  isProjectActive?: boolean;
}

export default function EditorTopNav({
  onToolSelect,
  onExport,
  onNewProject,
  isProjectActive,
}: EditorTopNavProps) {
  const { activeTool } = useEditor();

  const handleNew = () => {
    if (
      window.confirm(
        "Start a new project? Your current canvas will be cleared.",
      )
    ) {
      onNewProject?.();
    }
  };

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-5">
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <img className="w-7 h-7 0 flex items-center justify-center" src="/svg-readme-logo.png" />
          <span className="font-[Poppins] font-medium text-[15px]">
            svg-readme
          </span>
          <span className="ml-1 px-2 py-0.5 rounded text-[11px] font-[JetBrains_Mono] bg-zinc-800/50 text-zinc-400 border border-white/5">
            draft
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg border border-white/5 p-1.5 mr-4">
          <button
            className={`p-2 rounded-md transition-all ${activeTool === "move"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-100"
              }`}
            onClick={() => onToolSelect?.("move")}
            title="Move (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-md transition-all ${activeTool === "text"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-100"
              }`}
            onClick={() => onToolSelect?.("text")}
            title="Text (T)"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        {isProjectActive && (
          <button
            onClick={handleNew}
            title="New Project"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-md transition-all duration-200"
          >
            <FilePlus2 className="w-4 h-4" />
            New
          </button>
        )}

        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-md transition-all duration-200">
          <Save className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all duration-200 border border-blue-500/50"
        >
          <Download className="w-4 h-4" />
          Export SVG
        </button>
      </div>
    </header>
  );
}
