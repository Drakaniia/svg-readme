import { useCallback, useEffect, useRef } from "react";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../../../context/EditorContext";
import {
  flushAutosave,
  autosave as autosaveFn,
  resetPersistence,
  setCurrentProjectId as setPersistenceProjectId,
  saveDocument,
  type DocumentState as PersistenceDocState,
} from "../../../lib/persistence";
import { clearEditorStorage } from "../../../context/EditorContext";
import type { HistoryState } from "./useEditorHistory";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseEditorPersistenceParams {
  isProjectActive: boolean;
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  frameSize: { width: number; height: number };
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  setElementProperties: React.Dispatch<React.SetStateAction<Record<string, ElementProperties>>>;
  setFrameSize: (size: { width: number; height: number }) => void;
  setCurrentProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setIsProjectActive: (active: boolean) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  markClean: () => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryState>>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages document persistence: autosave on changes, load from backend,
 * save on demand, and new-project reset.
 */
export function useEditorPersistence({
  isProjectActive,
  layers,
  elementProperties,
  frameSize,
  setLayers,
  setElementProperties,
  setFrameSize,
  setCurrentProjectId,
  setProjectName,
  setIsProjectActive,
  setSelectedLayerId,
  setSelectedLayerIds,
  markClean,
  setHistory,
}: UseEditorPersistenceParams) {
  // ── Persistence: document ref for autosave + EditorTopNav Save button ───
  const persistenceDocRef = useRef<PersistenceDocState>({ layers, elementProperties, frameSize });
  useEffect(() => {
    persistenceDocRef.current = { layers, elementProperties, frameSize };
  }, [layers, elementProperties, frameSize]);

  // ── Autosave: debounced save on document changes ─────────────────────────
  useEffect(() => {
    if (!isProjectActive) return;
    const hasContent = layers.length > 0 && Object.keys(elementProperties).length > 0;
    if (!hasContent) return;
    autosaveFn(persistenceDocRef.current);
  }, [layers, elementProperties, isProjectActive]);

  // ── Load project from backend (triggered by navbar Open) ─────────────────
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        project: { id: string; name: string; canvasWidth: number; canvasHeight: number };
        doc: PersistenceDocState;
      };

      if (isProjectActive) {
        await flushAutosave(persistenceDocRef.current);
      }

      setLayers(detail.doc.layers);
      setElementProperties(detail.doc.elementProperties);
      setFrameSize(detail.doc.frameSize);
      setCurrentProjectId(detail.project.id);
      setProjectName(detail.project.name);
      setPersistenceProjectId(detail.project.id);
      setSelectedLayerId(null);
      setSelectedLayerIds([]);
      setIsProjectActive(true);
      setHistory({ past: [], future: [] });
      markClean();
    };

    window.addEventListener("load-project", handler);
    return () => window.removeEventListener("load-project", handler);
  }, [
    isProjectActive, setLayers, setElementProperties, setFrameSize,
    setCurrentProjectId, setProjectName, setIsProjectActive,
    setSelectedLayerId, setSelectedLayerIds, markClean, setHistory,
  ]);

  // ── New Project — reset all state and clear localStorage ─────────────────
  const handleNewProject = useCallback(() => {
    clearEditorStorage();
    setLayers([]);
    setElementProperties({});
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
    setIsProjectActive(false);
    setHistory({ past: [], future: [] });
    markClean();
    resetPersistence();
    setCurrentProjectId(null);
    setProjectName("Untitled");
  }, [setLayers, setElementProperties, setSelectedLayerId, setSelectedLayerIds, setIsProjectActive, markClean, setCurrentProjectId, setProjectName, setHistory]);

  // ── Manual save (called from keyboard shortcut) ─────────────────────────
  const handleSave = useCallback(() => {
    saveDocument(persistenceDocRef.current);
  }, []);

  return {
    persistenceDocRef,
    handleNewProject,
    handleSave,
  };
}
