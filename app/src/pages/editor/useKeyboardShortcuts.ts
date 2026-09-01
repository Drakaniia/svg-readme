import { useEffect, type RefObject } from "react";
import type { EditorTool, LayerType, ShapeSubTool } from "../../context/EditorContext";
import { clampZoom } from "../../lib/editor/geometry";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

const SHAPE_CYCLE: ShapeSubTool[] = ["rect", "circle", "triangle", "star", "hexagon", "line"];

export interface KeyboardShortcutHandlers {
  isEditingRef: RefObject<boolean>;
  handleCommitText: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  /** Ctrl+X: copy then delete the selection. */
  handleCut?: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleDuplicate: () => void;
  handleReorderLayers: (direction: "front" | "forward" | "back" | "backward") => void;
  handleDeleteSelectedLayers: () => void;
  handleGroup: () => void;
  handleUngroup: () => void;
  handleSmartDelete: (preserveChildren: boolean) => void;
  handleSave?: () => void;
  /** Ctrl+E: export the document as SVG (B5). */
  handleExport?: () => void;
  /** Ctrl+/ or ?: toggle the shortcut cheat-sheet popover (B5). */
  onToggleShortcuts?: () => void;
  setActiveTool: (tool: EditorTool) => void;
  selectedShapeKind?: ShapeSubTool;
  setSelectedShapeKind?: (kind: ShapeSubTool) => void;
  activeTool?: EditorTool;
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  setViewport: React.Dispatch<React.SetStateAction<{ zoom: number; panX: number; panY: number }>>;
  setGridEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onMoveStart?: () => void;
  onMoveElement?: (id: string, x: number, y: number) => void;
  /** Currently selected path node (move tool) — Delete removes the node instead of the layer. */
  selectedVertex?: { layerId: string; index: number } | null;
  onDeleteVertex?: (layerId: string, index: number) => void;
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const {
    isEditingRef,
    handleCommitText,
    handleCopy,
    handlePaste,
    handleCut,
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleReorderLayers,
    handleDeleteSelectedLayers,
    handleGroup,
    handleUngroup,
    handleSmartDelete,
    handleSave,
    handleExport,
    onToggleShortcuts,
    setActiveTool,
    selectedShapeKind,
    setSelectedShapeKind,
    activeTool,
    selectedLayerId,
    selectedLayerIds,
    setSelectedLayerId,
    setSelectedLayerIds,
    setViewport,
    setGridEnabled,
    onMoveStart,
    onMoveElement,
    selectedVertex,
    onDeleteVertex,
    layers,
    elementProperties,
  } = handlers;

  useEffect(() => {
    // ── Nudge helper (defined inside effect to avoid stale-closure issues) ──
    const nudgeSelection = (dx: number, dy: number) => {
      const ids = selectedLayerIds.length > 0 ? selectedLayerIds : (selectedLayerId ? [selectedLayerId] : []);
      if (ids.length === 0) return;
      onMoveStart?.();
      for (const id of ids) {
        const props = elementProperties[id];
        if (!props) continue;
        onMoveElement?.(id, props.x + dx, props.y + dy);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // If another handler (e.g. pen tool Escape → finalize) already handled this key, don't double-handle
      if (e.defaultPrevented) return;
      // Ignore when editing text (V/T would be typed as characters)
      if (isEditingRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCommitText();
        }
        return;
      }

      // e.target can be window/document (e.g. synthetic keydown on window) —
      // only check for form-focus when it's a real Element.
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      // Check for Ctrl/Cmd + key combinations
      const isCtrlPressed = e.ctrlKey || e.metaKey;

      // ── Arrow key nudge (B2) ──────────────────────────────────────────
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
          case "ArrowUp":    nudgeSelection(0, -step); break;
          case "ArrowDown":  nudgeSelection(0, step); break;
          case "ArrowLeft":  nudgeSelection(-step, 0); break;
          case "ArrowRight": nudgeSelection(step, 0); break;
        }
        return;
      }

      switch (e.key) {
        case "v":
        case "V":
          if (isCtrlPressed) {
            e.preventDefault();
            handlePaste();
          } else {
            e.preventDefault();
            setActiveTool("move");
          }
          break;
        case "c":
        case "C":
          if (isCtrlPressed) {
            e.preventDefault();
            handleCopy();
          }
          break;
        case "t":
        case "T":
          e.preventDefault();
          setActiveTool("text");
          break;
        case "p":
        case "P":
          e.preventDefault();
          setActiveTool("pen");
          break;
        // ── B5: Shape tool shortcuts (Phase 2 grouped model) ─────────────
        case "r":
        case "R": {
          e.preventDefault();
          if (setSelectedShapeKind) {
            const cur = selectedShapeKind ?? "rect";
            const idx = SHAPE_CYCLE.indexOf(cur);
            // If already on shape tool, cycle; otherwise pick rect (first press)
            const next = activeTool === "shape" && idx !== -1 ? SHAPE_CYCLE[(idx + 1) % SHAPE_CYCLE.length]! : "rect";
            setSelectedShapeKind(next as ShapeSubTool);
          }
          setActiveTool("shape");
          break;
        }
        case "o":
        case "O":
          e.preventDefault();
          setSelectedShapeKind?.("circle");
          setActiveTool("shape");
          break;
        case "l":
        case "L":
          e.preventDefault();
          setSelectedShapeKind?.("line");
          setActiveTool("shape");
          break;
        case "h":
        case "H":
          e.preventDefault();
          setActiveTool("hand");
          break;
        // ── Select all / deselect ──────────────────────────────────────
        case "a":
        case "A":
          if (isCtrlPressed) {
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl+Shift+A: deselect all
              setSelectedLayerIds([]);
              setSelectedLayerId(null);
            } else {
              // Ctrl+A: select all visible layers with properties
              const allIds = layers
                .filter((l) => l.visible && elementProperties[l.id])
                .map((l) => l.id);
              setSelectedLayerIds(allIds);
              setSelectedLayerId(allIds[0] ?? null);
            }
          }
          break;
        case "z":
        case "Z":
          if (isCtrlPressed) {
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
          }
          break;
        case "y":
        case "Y":
          if (isCtrlPressed) {
            e.preventDefault();
            handleRedo();
          }
          break;
        case "s":
        case "S":
          if (isCtrlPressed) {
            e.preventDefault();
            handleSave?.();
          }
          break;
        case "d":
        case "D":
          if (isCtrlPressed) {
            e.preventDefault();
            handleDuplicate();
          }
          break;
        case "e":
        case "E":
          if (isCtrlPressed) {
            e.preventDefault();
            handleExport?.();
          }
          break;
        case "x":
        case "X":
          if (isCtrlPressed) {
            e.preventDefault();
            handleCut?.();
          }
          break;
        case "/":
          if (isCtrlPressed) {
            e.preventDefault();
            onToggleShortcuts?.();
          }
          break;
        case "?":
          // Shift+/? — opens the shortcut cheat sheet.
          e.preventDefault();
          onToggleShortcuts?.();
          break;
        case "]":
          if (isCtrlPressed) {
            e.preventDefault();
            handleReorderLayers(e.shiftKey ? "front" : "forward");
          }
          break;
        case "[":
          if (isCtrlPressed) {
            e.preventDefault();
            handleReorderLayers(e.shiftKey ? "back" : "backward");
          }
          break;
        case "0":
          e.preventDefault();
          setViewport({ zoom: 1, panX: 0, panY: 0 });
          break;
        case "-":
          e.preventDefault();
          setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom * 0.9) }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setViewport((current) => ({ ...current, zoom: clampZoom(current.zoom * 1.1) }));
          break;
        case "g":
        case "G":
          e.preventDefault();
          if (isCtrlPressed) {
            if (e.shiftKey) {
              handleUngroup();
            } else {
              handleGroup();
            }
          } else {
            setGridEnabled((enabled) => !enabled);
          }
          break;
        case "F2":
          // F2: start renaming the first selected layer
          e.preventDefault();
          if (selectedLayerIds.length > 0) {
            window.dispatchEvent(
              new CustomEvent("layer-rename-start", {
                detail: { layerId: selectedLayerIds[0] },
              }),
            );
          } else if (selectedLayerId) {
            window.dispatchEvent(
              new CustomEvent("layer-rename-start", {
                detail: { layerId: selectedLayerId },
              }),
            );
          }
          break;
        case "Escape":
          // Escape: if layers are selected, deselect them; otherwise cancel tool
          if (selectedLayerIds.length > 0 || selectedLayerId) {
            setSelectedLayerIds([]);
            setSelectedLayerId(null);
          } else {
            setActiveTool("move");
          }
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          if (e.altKey) {
            // Alt+Delete keeps its smart-delete meaning even with a node selected.
            handleSmartDelete(true);
          } else if (selectedVertex) {
            // Node editing: delete the selected anchor, not the layer.
            onDeleteVertex?.(selectedVertex.layerId, selectedVertex.index);
          } else {
            handleDeleteSelectedLayers();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isEditingRef,
    handleCommitText,
    handleCopy,
    handlePaste,
    handleCut,
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleReorderLayers,
    handleDeleteSelectedLayers,
    handleGroup,
    handleUngroup,
    handleSmartDelete,
    handleSave,
    handleExport,
    onToggleShortcuts,
    setActiveTool,
    selectedShapeKind,
    setSelectedShapeKind,
    activeTool,
    selectedLayerId,
    selectedLayerIds,
    setSelectedLayerId,
    setSelectedLayerIds,
    setViewport,
    setGridEnabled,
    onMoveStart,
    onMoveElement,
    selectedVertex,
    onDeleteVertex,
    layers,
    elementProperties,
  ]);
}
