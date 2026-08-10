import { useCallback, useMemo, type MutableRefObject } from "react";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import type { ReorderDirection } from "../../lib/editor/documentActions";
import {
  reorderSelectedLayers,
  groupLayers,
  ungroupLayer,
  canGroupLayers,
  duplicateLayersWithChildren,
} from "../../lib/editor/documentActions";
import {
  flattenGroup,
  wrapInFrame,
  toggleLayerMask,
  applyBooleanOp,
  outlineText,
  outlineStroke,
  smartDelete,
} from "../../lib/editor/layerOps";

export interface LayerOperationsParams {
  documentRef: MutableRefObject<{
    layers: LayerType[];
    elementProperties: Record<string, ElementProperties>;
    selectedLayerIds: string[];
  }>;
  saveToHistory: () => void;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  setElementProperties: React.Dispatch<React.SetStateAction<Record<string, ElementProperties>>>;
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedLayerId: (id: string | null) => void;
}

export function useLayerOperations(params: LayerOperationsParams) {
  const {
    documentRef,
    saveToHistory,
    setLayers,
    setElementProperties,
    setSelectedLayerIds,
    setSelectedLayerId,
  } = params;

  // ── Duplicate ──────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(() => {
    const { layers: currentLayers, elementProperties: currentProperties, selectedLayerIds: currentSelection } = documentRef.current;

    const result = duplicateLayersWithChildren(
      currentLayers,
      currentProperties,
      currentSelection,
    );
    if (!result) return;
    const { duplicatedLayers, duplicatedProperties, duplicatedTopIds } = result;

    saveToHistory();
    setLayers((previous) => [
      ...previous.map((layer) => ({ ...layer, active: false })),
      ...duplicatedLayers,
    ]);
    setElementProperties((previous) => ({ ...previous, ...duplicatedProperties }));
    setSelectedLayerIds(duplicatedTopIds);
    setSelectedLayerId(duplicatedTopIds[0] ?? null);
  }, [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId]);

  // ── Reorder layers ────────────────────────────────────────────────────
  const handleReorderLayers = useCallback((direction: ReorderDirection) => {
    const currentSelection = documentRef.current.selectedLayerIds;
    if (currentSelection.length === 0) return;

    saveToHistory();
    setLayers((previous) => reorderSelectedLayers(previous, currentSelection, direction));
  }, [documentRef, saveToHistory, setLayers]);

  // ── Group ─────────────────────────────────────────────────────────────
  const handleGroup = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    const currentLayers = documentRef.current.layers;
    if (!canGroupLayers(currentLayers, currentSelection)) return;

    saveToHistory();
    setLayers((previous) => {
      const result = groupLayers(previous, currentSelection);
      if (!result) return previous;
      return result.updatedLayers;
    });
  }, [documentRef, saveToHistory, setLayers]);

  // ── Ungroup ───────────────────────────────────────────────────────────
  const handleUngroup = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    const currentLayers = documentRef.current.layers;

    const groupId = currentSelection.find((id) => {
      const layer = currentLayers.find((l) => l.id === id);
      return layer?.type === "group";
    });
    if (!groupId) return;

    saveToHistory();
    setLayers((previous) => {
      const result = ungroupLayer(previous, groupId);
      if (!result) return previous;
      setSelectedLayerIds(result.childIds);
      setSelectedLayerId(result.childIds[0] ?? null);
      return result.updatedLayers;
    });
  }, [documentRef, saveToHistory, setLayers, setSelectedLayerIds, setSelectedLayerId]);

  // ── Flatten group ─────────────────────────────────────────────────────
  const handleFlatten = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    const currentLayers = documentRef.current.layers;
    const currentProperties = documentRef.current.elementProperties;
    const groupId = currentSelection.find((id) => {
      const layer = currentLayers.find((l) => l.id === id);
      return layer?.type === "group";
    });
    if (!groupId) return;

    saveToHistory();
    setLayers((previous) => {
      const result = flattenGroup(previous, currentProperties, groupId);
      if (!result) return previous;
      setElementProperties(result.updatedProperties);
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
      return result.updatedLayers;
    });
  }, [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId]);

  // ── Wrap in frame ─────────────────────────────────────────────────────
  const handleWrapInFrame = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    if (currentSelection.length === 0) return;

    saveToHistory();
    setLayers((previous) => {
      const result = wrapInFrame(previous, currentSelection);
      if (!result) return previous;
      setSelectedLayerIds([result.groupId]);
      setSelectedLayerId(result.groupId);
      return result.updatedLayers;
    });
  }, [documentRef, saveToHistory, setLayers, setSelectedLayerIds, setSelectedLayerId]);

  // ── Toggle mask ───────────────────────────────────────────────────────
  const handleToggleMask = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    if (currentSelection.length === 0) return;
    const targetId = currentSelection[0];
    const currentProperties = documentRef.current.elementProperties;

    saveToHistory();
    setLayers((previous) => {
      const result = toggleLayerMask(previous, currentProperties, targetId);
      if (!result) return previous;
      setElementProperties(result.updatedProperties);
      return result.updatedLayers;
    });
  }, [documentRef, saveToHistory, setLayers, setElementProperties]);

  // ── Boolean operations ────────────────────────────────────────────────
  const handleBooleanOp = useCallback(
    (op: "union" | "subtract" | "intersect" | "exclude") => {
      const currentSelection = documentRef.current.selectedLayerIds;
      const currentLayers = documentRef.current.layers;
      const currentProperties = documentRef.current.elementProperties;
      if (currentSelection.length < 2) return;

      saveToHistory();
      const result = applyBooleanOp(currentLayers, currentProperties, currentSelection, op);
      if (!result) return;
      setLayers(result.updatedLayers);
      setElementProperties(result.updatedProperties);
      setSelectedLayerIds([result.resultId]);
      setSelectedLayerId(result.resultId);
    },
    [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  // ── Outline text ──────────────────────────────────────────────────────
  const handleOutlineText = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    const currentLayers = documentRef.current.layers;
    const currentProperties = documentRef.current.elementProperties;
    const textId = currentSelection.find((id) => {
      const props = currentProperties[id];
      return props?.type === "text";
    });
    if (!textId) return;

    saveToHistory();
    const result = outlineText(currentLayers, currentProperties, textId);
    if (!result) return;
    setLayers(result.updatedLayers);
    setElementProperties(result.updatedProperties);
    setSelectedLayerIds([result.pathId]);
    setSelectedLayerId(result.pathId);
  }, [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId]);

  // ── Outline stroke ────────────────────────────────────────────────────
  const handleOutlineStroke = useCallback(() => {
    const currentSelection = documentRef.current.selectedLayerIds;
    const currentLayers = documentRef.current.layers;
    const currentProperties = documentRef.current.elementProperties;
    const shapeId = currentSelection.find((id) => {
      const props = currentProperties[id];
      return props?.type === "shape" || props?.type === "path";
    });
    if (!shapeId) return;

    saveToHistory();
    const result = outlineStroke(currentLayers, currentProperties, shapeId);
    if (!result) return;
    setLayers(result.updatedLayers);
    setElementProperties(result.updatedProperties);
    setSelectedLayerIds([result.pathId]);
    setSelectedLayerId(result.pathId);
  }, [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId]);

  // ── Smart delete (Alt+Delete) ─────────────────────────────────────────
  const handleSmartDelete = useCallback(
    (preserveChildren: boolean) => {
      const currentSelection = documentRef.current.selectedLayerIds;
      const currentLayers = documentRef.current.layers;
      const currentProperties = documentRef.current.elementProperties;
      if (currentSelection.length === 0) return;

      const hasLocked = currentSelection.some((id) => {
        const layer = currentLayers.find((l) => l.id === id);
        return layer?.locked;
      });
      if (hasLocked) return;

      saveToHistory();
      const result = smartDelete(currentLayers, currentProperties, currentSelection, preserveChildren);
      if (!result) return;
      setLayers(result.updatedLayers);
      setElementProperties(result.updatedProperties);
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
    },
    [documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  // ── Toggle visibility ─────────────────────────────────────────────────
  const handleToggleLayerVisibility = useCallback(() => {
    const sel = documentRef.current.selectedLayerIds;
    const firstId = sel[0];
    if (!firstId) return;
    const layer = documentRef.current.layers.find((l) => l.id === firstId);
    if (!layer) return;
    saveToHistory();
    const newVisible = !layer.visible;
    setLayers((prev) =>
      prev.map((l) =>
        l.id === firstId ? { ...l, visible: newVisible } : l,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("layer-toggle-visibility", {
        detail: { id: firstId, visible: newVisible },
      }),
    );
  }, [documentRef, saveToHistory, setLayers]);

  // ── Toggle lock ───────────────────────────────────────────────────────
  const handleToggleLayerLock = useCallback(() => {
    const sel = documentRef.current.selectedLayerIds;
    const firstId = sel[0];
    if (!firstId) return;
    const layer = documentRef.current.layers.find((l) => l.id === firstId);
    if (!layer) return;
    saveToHistory();
    const newLocked = !layer.locked;
    setLayers((prev) =>
      prev.map((l) =>
        l.id === firstId ? { ...l, locked: newLocked } : l,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("layer-toggle-lock", {
        detail: { id: firstId, locked: newLocked },
      }),
    );
  }, [documentRef, saveToHistory, setLayers]);

  // ── Layer context menu action handler ─────────────────────────────────
  // The action map is memoized (not a ref written during render) so the
  // context menu can look up handlers by action id without a render-time
  // ref mutation. All handlers are stable useCallbacks, so this is cheap.
  const layerActionMap = useMemo<Record<string, () => void>>(
    () => ({
      duplicate: handleDuplicate,
      bringToFront: () => handleReorderLayers("front"),
      bringForward: () => handleReorderLayers("forward"),
      sendBackward: () => handleReorderLayers("backward"),
      sendToBack: () => handleReorderLayers("back"),
      group: handleGroup,
      ungroup: handleUngroup,
      wrapInFrame: handleWrapInFrame,
      toggleVisibility: handleToggleLayerVisibility,
      toggleLock: handleToggleLayerLock,
      flatten: handleFlatten,
      outlineText: handleOutlineText,
      outlineStroke: handleOutlineStroke,
      toggleMask: handleToggleMask,
      booleanUnion: () => handleBooleanOp("union"),
      booleanSubtract: () => handleBooleanOp("subtract"),
      booleanIntersect: () => handleBooleanOp("intersect"),
      booleanExclude: () => handleBooleanOp("exclude"),
      copyAsPng: () => window.dispatchEvent(new CustomEvent("copy-png-image")),
    }),
    [
      handleDuplicate,
      handleReorderLayers,
      handleGroup,
      handleUngroup,
      handleWrapInFrame,
      handleToggleLayerVisibility,
      handleToggleLayerLock,
      handleFlatten,
      handleOutlineText,
      handleOutlineStroke,
      handleToggleMask,
      handleBooleanOp,
    ],
  );

  const handleLayerContextAction = useCallback(
    (actionId: string) => {
      layerActionMap[actionId]?.();
    },
    [layerActionMap],
  );

  return {
    handleDuplicate,
    handleReorderLayers,
    handleGroup,
    handleUngroup,
    handleFlatten,
    handleWrapInFrame,
    handleToggleMask,
    handleBooleanOp,
    handleOutlineText,
    handleOutlineStroke,
    handleSmartDelete,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleLayerContextAction,
  };
}
