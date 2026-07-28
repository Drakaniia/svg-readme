import type { ReactNode } from "react";
import EditorTopNav from "../components/ui/EditorTopNav";
import EditorSidebar from "../components/ui/EditorSidebar";
import EditorRightBar from "../components/ui/EditorRightBar";
import type { EditorTool } from "../context/EditorContext";
import { type FrameSize } from "../components/editor-sidebar/FramePanel";
import type { TextElementProperties } from "../components/editor-canvas/ElementsRenderer";

interface EditorLayoutProps {
  children: ReactNode;
  frameSize: FrameSize;
  setFrameSize: (size: FrameSize) => void;
  onToolSelect?: (tool: EditorTool) => void;
  onExport?: () => void;
  elementProperties: Record<string, TextElementProperties>;
  selectedLayerIds: string[];
  onMoveElement: (id: string, x: number, y: number) => void;
  onUpdateElementProperty: (
    id: string,
    updates: Partial<TextElementProperties>,
  ) => void;
}

export default function EditorLayout({
  children,
  frameSize,
  setFrameSize,
  onToolSelect,
  onExport,
  elementProperties,
  selectedLayerIds,
  onMoveElement,
  onUpdateElementProperty,
}: EditorLayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-zinc-100 font-[Poppins] selection:bg-blue-500/30 selection:text-white">
      <EditorTopNav onToolSelect={onToolSelect} onExport={onExport} />

      <div className="flex flex-1 overflow-hidden relative">
        <EditorSidebar
          frameSize={frameSize}
          setFrameSize={setFrameSize}
          onToolSelect={onToolSelect}
        />

        <main className="flex-1 overflow-auto flex items-center justify-center bg-zinc-950/50 relative shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
          {/* Subtle grid pattern for the canvas background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          {children}
        </main>

        <EditorRightBar
          onExport={onExport}
          elementProperties={elementProperties}
          selectedLayerIds={selectedLayerIds}
          onMoveElement={onMoveElement}
          onUpdateElementProperty={onUpdateElementProperty}
        />
      </div>
    </div>
  );
}
