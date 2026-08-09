import { useEffect } from "react";
import LayerPanel from "../editor-sidebar/LayerPanel";
import type { LayerType } from "../../context/EditorContext";
import FramePanel from "../editor-sidebar/FramePanel";
import type { FrameSize } from "../editor-sidebar/FramePanel";
import ToolPanel from "../editor-sidebar/ToolPanel";
import { useEditor, type EditorTool } from "../../context/EditorContext";
import {
  getLayers,
  createLayer,
  updateLayer,
  deleteLayer,
  reorderLayers,
  type ApiLayer,
} from "../../lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMP_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toLayerType = (l: ApiLayer): LayerType => ({
  id: l.id,
  name: l.name,
  type: (l.type as LayerType["type"]) ?? "shape",
  locked: l.locked,
  visible: l.visible,
  active: l.active ?? false,
  parentId: l.parentId ?? null,
  collapsed: l.collapsed ?? false,
});

// ─── Component ────────────────────────────────────────────────────────────────

interface EditorSidebarProps {
  frameSize: FrameSize;
  setFrameSize: (size: FrameSize) => void;
  onToolSelect?: (tool: EditorTool) => void;
  onLayerContextAction?: (actionId: string, layerId: string) => void;
}

export default function EditorSidebar({
  frameSize,
  setFrameSize,
  onToolSelect,
  onLayerContextAction,
}: EditorSidebarProps) {
  const { layers, setLayers, selectLayer, clearSelection, elementProperties } = useEditor();
  const projectId = TEMP_PROJECT_ID;

  // ── Fetch layers from backend only if local state is empty ───────────────
  useEffect(() => {
    // Only load from backend if we have no layers locally (prevent overwrite)
    if (layers.length > 0) return;

    getLayers(projectId)
      .then((fetched) => {
        if (fetched.length > 0) {
          setLayers(fetched.map(toLayerType));
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // intentionally only on projectId change, not layers change

  // ── Layer callbacks (called by LayerPanel after optimistic updates) ────────
  const handleLayerAdd = (layer: LayerType, insertIndex: number) => {
    createLayer(projectId, {
      id: layer.id,
      name: layer.name,
      orderIndex: insertIndex,
    })
      .then(() => {
        // After successfully creating, we can optionally trigger a reorder sync for the other layers
        setLayers((prev) => {
          reorderLayers(
            projectId,
            prev.map((l, i) => ({ id: l.id, orderIndex: i })),
          ).catch(console.error);
          return prev;
        });
      })
      .catch(console.error);
  };

  const handleLayerDelete = (id: string) => {
    deleteLayer(projectId, id).catch(console.error);
  };

  const handleLayerRename = (id: string, name: string) => {
    updateLayer(projectId, id, { name }).catch(console.error);
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    updateLayer(projectId, id, { visible }).catch(console.error);
  };

  const handleToggleLock = (id: string, locked: boolean) => {
    updateLayer(projectId, id, { locked }).catch(console.error);
  };

  const handleLayerReorder = (
    ordered: { id: string; orderIndex: number }[],
  ) => {
    reorderLayers(projectId, ordered).catch(console.error);
  };

  // ── Listen for context menu events for backend persistence ────────────
  useEffect(() => {
    const handleVisibilityEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        updateLayer(projectId, detail.id, { visible: detail.visible }).catch(console.error);
      }
    };
    const handleLockEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        updateLayer(projectId, detail.id, { locked: detail.locked }).catch(console.error);
      }
    };
    window.addEventListener("layer-toggle-visibility", handleVisibilityEvent);
    window.addEventListener("layer-toggle-lock", handleLockEvent);
    return () => {
      window.removeEventListener("layer-toggle-visibility", handleVisibilityEvent);
      window.removeEventListener("layer-toggle-lock", handleLockEvent);
    };
  }, [projectId]);

  return (
    <aside className="w-72 shrink-0 border-r border-white/5 bg-[#09090b]/95 backdrop-blur-xl flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      {/* Tools Section */}
      <ToolPanel onToolSelect={onToolSelect} />

      {/* Frame size controls — always visible for canvas resizing */}
      <FramePanel frameSize={frameSize} setFrameSize={setFrameSize} />

      {/* Layers Section */}
      <LayerPanel
        layers={layers}
        setLayers={setLayers}
        elementProperties={elementProperties}
        onAdd={handleLayerAdd}
        onDelete={handleLayerDelete}
        onRename={handleLayerRename}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        onReorder={handleLayerReorder}
        onContextAction={onLayerContextAction}
        onSelectLayer={(id) => selectLayer(id, false)}
        onClearSelection={clearSelection}
      />
    </aside>
  );
}
