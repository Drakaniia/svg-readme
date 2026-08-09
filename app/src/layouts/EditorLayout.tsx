import type { ReactNode, MutableRefObject } from "react";
import EditorTopNav from "../components/ui/EditorTopNav";
import EditorSidebar from "../components/ui/EditorSidebar";
import EditorRightBar from "../components/ui/EditorRightBar";
import type { EditorTool } from "../context/EditorContext";
import { type FrameSize } from "../components/editor-sidebar/FramePanel";
import type { ElementProperties } from "../components/editor-canvas/ElementsRenderer";
import type { DocumentState } from "../lib/persistence";

interface EditorLayoutProps {
  children: ReactNode;
  frameSize: FrameSize;
  setFrameSize: (size: FrameSize) => void;
  onToolSelect?: (tool: EditorTool) => void;
  onExport?: () => void;
  onNewProject?: () => void;
  isProjectActive?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  selectedLayerIds?: string[];
  elementProperties?: Record<string, ElementProperties>;
  onUpdateProperties?: (id: string, updates: Partial<ElementProperties>) => void;
  onBulkUpdateProperties?: (updates: Partial<ElementProperties>) => void;
  onPropertiesStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  onAlignmentStart?: () => void;
  onLayerContextAction?: (actionId: string, layerId: string) => void;
  /** Live document state ref for the navbar Save button / autosave flush. */
  documentRef?: MutableRefObject<DocumentState>;
}

export default function EditorLayout({
  children,
  frameSize,
  setFrameSize,
  onToolSelect,
  onExport,
  onNewProject,
  isProjectActive,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedLayerIds,
  elementProperties,
  onUpdateProperties,
  onBulkUpdateProperties,
  onPropertiesStart,
  onMoveElement,
  onAlignmentStart,
  onLayerContextAction,
  documentRef,
}: EditorLayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-zinc-100 font-[Poppins] selection:bg-blue-500/30 selection:text-white">
      <EditorTopNav
        onExport={onExport}
        onNewProject={onNewProject}
        isProjectActive={isProjectActive}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        frameSize={isProjectActive ? frameSize : undefined}
        documentRef={documentRef}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <EditorSidebar
          frameSize={frameSize}
          setFrameSize={setFrameSize}
          onToolSelect={onToolSelect}
          onLayerContextAction={onLayerContextAction}
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
          selectedLayerIds={selectedLayerIds}
          elementProperties={elementProperties}
          onUpdateProperties={onUpdateProperties}
          onBulkUpdateProperties={onBulkUpdateProperties}
          onPropertiesStart={onPropertiesStart}
          onMoveElement={onMoveElement}
          onAlignmentStart={onAlignmentStart}
          frameSize={frameSize}
        />
      </div>
    </div>
  );
}
