import { useCallback, useState } from "react";
import {
  cloneDocumentSnapshot,
  pushHistory,
  redoDocument,
  undoDocument,
  type DocumentSnapshot,
} from "../../../lib/editor/documentActions";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../../../context/EditorContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryState {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}

interface DocumentRef {
  current: {
    layers: LayerType[];
    elementProperties: Record<string, ElementProperties>;
    selectedLayerIds: string[];
  };
}

interface UseEditorHistoryParams {
  documentRef: DocumentRef;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  setElementProperties: React.Dispatch<React.SetStateAction<Record<string, ElementProperties>>>;
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLayerId: (id: string | null) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages undo/redo history for the editor document.
 * Provides `saveToHistory` (call before any mutation), `handleUndo`, and `handleRedo`.
 */
export function useEditorHistory({
  documentRef,
  setLayers,
  setElementProperties,
  setSelectedLayerIds,
  setSelectedLayerId,
}: UseEditorHistoryParams) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });

  const currentSnapshot = useCallback((): DocumentSnapshot => ({
    layers: documentRef.current.layers,
    elementProperties: documentRef.current.elementProperties,
    selectedLayerIds: documentRef.current.selectedLayerIds,
  }), [documentRef]);

  const saveToHistory = useCallback(() => {
    const snapshot = cloneDocumentSnapshot(currentSnapshot());
    setHistory((prevHistory) => ({
      past: pushHistory(prevHistory.past, snapshot),
      future: [],
    }));
  }, [currentSnapshot]);

  const restoreSnapshot = useCallback((snapshot: DocumentSnapshot) => {
    const selected = new Set(snapshot.selectedLayerIds);
    setLayers(snapshot.layers.map((layer) => ({ ...layer, active: selected.has(layer.id) })));
    setElementProperties(snapshot.elementProperties);
    setSelectedLayerIds(snapshot.selectedLayerIds);
    setSelectedLayerId(snapshot.selectedLayerIds[0] ?? null);
  }, [setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId]);

  const handleUndo = useCallback(() => {
    const transition = undoDocument(history, currentSnapshot());
    if (!transition.snapshot) return;
    restoreSnapshot(transition.snapshot);
    setHistory(transition.history);
  }, [currentSnapshot, history, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const transition = redoDocument(history, currentSnapshot());
    if (!transition.snapshot) return;
    restoreSnapshot(transition.snapshot);
    setHistory(transition.history);
  }, [currentSnapshot, history, restoreSnapshot]);

  return {
    history,
    setHistory,
    saveToHistory,
    handleUndo,
    handleRedo,
  };
}
