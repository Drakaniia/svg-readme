import { useEffect, useCallback, useRef, useState } from "react";
import { clampZoom } from "../../lib/editor/geometry";
import {
  cloneDocumentSnapshot,
  pushHistory,
  redoDocument,
  undoDocument,
  type DocumentSnapshot,
} from "../../lib/editor/documentActions";
import ViewportControls from "../../components/editor-canvas/ViewportControls";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useLayerOperations } from "./useLayerOperations";
import { useSvgImport } from "./useSvgImport";
import EditorLayout from "../../layouts/EditorLayout";
import { useEditor, clearEditorStorage } from "../../context/EditorContext";
import type { EditorTool, LayerType } from "../../context/EditorContext";
import Canvas from "../../components/editor-canvas/Canvas";
import type { TextElementProperties, ShapeElementProperties, ImageElementProperties, PathElementProperties, ElementProperties, ShapeKind } from "../../components/editor-canvas/ElementsRenderer";
import { computePathBounds } from "../../components/editor-canvas/ElementsRenderer";
import {
  translatePoints,
  rescalePoints,
  splitSegment,
  deleteVertex,
  toggleVertexSmooth,
  shiftVertexHandles,
  mirrorPoint,
} from "../../lib/editor/pathUtils";
import type { PathVertexHandle } from "../../lib/editor/pathUtils";
import { DEFAULT_TEXT_PROPS, DEFAULT_TEXT_HEIGHT } from "../../components/editor-canvas/types";
import { computeAutoSize } from "../../lib/editor/textMeasure";
import { parseSvgMarkup } from "../../lib/importSvg";
import { createLayer } from "../../lib/api";
import {
  saveDocument,
  flushAutosave,
  autosave as autosaveFn,
  resetPersistence,
  setCurrentProjectId as setPersistenceProjectId,
  type DocumentState as PersistenceDocState,
} from "../../lib/persistence";
import {
  buildSvgString,
  downloadSvg,
  copySvgText,
  copyMarkdown,
  copyImageToClipboard,
} from "../../lib/export";
import { downloadPng } from "../../lib/exportPng";
import { exportAnimated, downloadGif } from "../../lib/animatedExport";
import type { ExportOptions } from "../../components/ui/EditorRightBar";
import { duplicateLayersWithChildren } from "../../lib/editor/documentActions";
import { ShortcutGrid } from "./EditorInnerShortcuts";


// ── Types for clipboard and undo history ───────────────────────────────────

interface ClipboardState {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
}

interface HistoryState {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMP_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

// ─── Inner component that uses context ────────────────────────────────────────

export function EditorInner() {
  const {
    activeTool,
    setActiveTool,
    isEditingText,
    setIsEditingText,
    selectedLayerId,
    selectedLayerIds,
    setSelectedLayerId,
    setSelectedLayerIds,
    selectLayer,
    clearSelection,
    layers,
    setLayers,
    elementProperties,
    setElementProperties,
    frameSize,
    setFrameSize,
    isProjectActive,
    setIsProjectActive,
    previewAnimation,
    scrubTime,
    markClean,
    isDirty,
    setCurrentProjectId,
    setProjectName,
  } = useEditor();

  const [customWidth, setCustomWidth] = useState("800");
  const [customHeight, setCustomHeight] = useState("200");

  // Text editing state
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Undo/Redo history state
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // ── Path node editing state (move tool) ─────────────────────────────────
  const [selectedVertex, setSelectedVertex] = useState<{
    layerId: string;
    index: number;
  } | null>(null);

  // Clear node selection when the tool changes or the path is deselected.
  useEffect(() => {
    if (!selectedVertex) return;
    if (
      activeTool !== "move" ||
      !selectedLayerIds.includes(selectedVertex.layerId)
    ) {
      // Derived state that must not persist across tool/selection changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedVertex(null);
    }
  }, [activeTool, selectedLayerIds, selectedVertex]);

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
  }, [setLayers, setElementProperties, setSelectedLayerId, setSelectedLayerIds, setIsProjectActive, markClean, setCurrentProjectId, setProjectName]);

  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditingText;
  }, [isEditingText]);

  // Hidden file input for image uploads
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Ref for export data to avoid re-registering event listeners on every render
  const documentRef = useRef({ layers, elementProperties, selectedLayerIds });
  useEffect(() => {
    documentRef.current = { layers, elementProperties, selectedLayerIds };
  }, [layers, elementProperties, selectedLayerIds]);

  // Ref for export data to avoid re-registering event listeners on every render
  const exportDataRef = useRef({ frameSize, elementProperties, layers });
  useEffect(() => {
    exportDataRef.current = { frameSize, elementProperties, layers };
  }, [frameSize, elementProperties, layers]);

  // ── Persistence: document ref for autosave + EditorTopNav Save button ───
  const persistenceDocRef = useRef<PersistenceDocState>({ layers, elementProperties, frameSize });
  useEffect(() => {
    persistenceDocRef.current = { layers, elementProperties, frameSize };
  }, [layers, elementProperties, frameSize]);

  // ── Autosave: debounced save on document changes ─────────────────────────
  useEffect(() => {
    if (!isProjectActive) return;
    // Only autosave if there are layers with properties (not empty canvas)
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

      // Flush any pending autosave before loading
      if (isProjectActive) {
        await flushAutosave(persistenceDocRef.current);
      }

      // Restore document
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
    setSelectedLayerId, setSelectedLayerIds, markClean,
  ]);



  const currentSnapshot = useCallback((): DocumentSnapshot => ({
    layers: documentRef.current.layers,
    elementProperties: documentRef.current.elementProperties,
    selectedLayerIds: documentRef.current.selectedLayerIds,
  }), []);

  // ── Save current state to history ──────────────────────────────────────
  const saveToHistory = useCallback(
    () => {
      // Save the complete pre-action document snapshot. The action label is
      // intentionally not persisted: history restores document state only.
      // pushHistory caps the stack at HISTORY_LIMIT and skips no-op pushes
      // (identical consecutive snapshots — e.g. focusing an input without
      // changing its value would otherwise spam history).
      const snapshot = cloneDocumentSnapshot(currentSnapshot());
      setHistory((prevHistory) => ({
        past: pushHistory(prevHistory.past, snapshot),
        future: [],
      }));
    },
    [currentSnapshot],
  );

  // ── Move element (defined early for keyboard shortcut nudge) ──────────
  const handleMoveStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  const handleMoveElement = useCallback((id: string, x: number, y: number) => {
    setElementProperties((prev) => {
      const props = prev[id];
      if (!props) return prev;
      if (props.type === "path") {
        // Path geometry lives in absolute points — translate them along with the box.
        const { points, handles, bounds, subpaths } = translatePoints(
          props.points,
          x - props.x,
          y - props.y,
          props.handles,
          props.subpaths,
        );
        return { ...prev, [id]: { ...props, points, handles, subpaths, ...bounds } };
      }
      return { ...prev, [id]: { ...props, x, y } };
    });
  }, [setElementProperties]);

  // ── Delete the selected path node (Delete/Backspace with a node selected) ─
  const handleDeleteVertex = useCallback(
    (layerId: string, vertexIndex: number) => {
      saveToHistory();
      setElementProperties((prev) => {
        const props = prev[layerId];
        if (!props || props.type !== "path") return prev;
        if (props.points.length <= 2) return prev;
        const { points, handles } = deleteVertex(
          props.points,
          props.handles,
          vertexIndex,
        );
        const closed = props.closed && points.length >= 3;
        const bounds = computePathBounds(points);
        return {
          ...prev,
          [layerId]: {
            ...props,
            points,
            handles,
            closed,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
        };
      });
      setSelectedVertex(null);
    },
    [saveToHistory, setElementProperties],
  );

  // ── Delete selected layers function ────────────────────────────────────
  const handleDeleteSelectedLayers = useCallback(() => {
    // Don't delete if no layers are selected
    if (selectedLayerIds.length === 0) return;

    // Don't delete if any selected layer is locked
    const hasLockedLayers = selectedLayerIds.some((id) => {
      const layer = layers.find((l) => l.id === id);
      return layer?.locked;
    });
    if (hasLockedLayers) return;

    // Save current state to history before deletion
    saveToHistory();

    // Collect all layer IDs to delete (selection + all descendants)
    const idsToDelete = new Set(selectedLayerIds);
    const collectDescendants = (parentId: string) => {
      layers.forEach((l) => {
        if ((l.parentId ?? null) === parentId) {
          idsToDelete.add(l.id);
          collectDescendants(l.id);
        }
      });
    };
    // Iterate a snapshot of the set since collectDescendants mutates it
    [...idsToDelete].forEach((id) => collectDescendants(id));

    // Delete selected layers and all descendants
    setLayers((prev) => prev.filter((l) => !idsToDelete.has(l.id)));

    // Clean up element properties for deleted layers
    setElementProperties((prev) => {
      const next = { ...prev };
      idsToDelete.forEach((id) => delete next[id]);
      return next;
    });

    // Clear selection
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
  }, [
    selectedLayerIds,
    layers,
    setLayers,
    setElementProperties,
    setSelectedLayerId,
    setSelectedLayerIds,
    saveToHistory,
  ]);

  // ── Copy selected layers to clipboard ───────────────────────────────────
  const handleCopy = useCallback(async () => {
    // Don't copy if no layers are selected
    if (selectedLayerIds.length === 0) return;

    // Copy selected layers and their properties
    const copiedLayers = layers.filter((layer) =>
      selectedLayerIds.includes(layer.id),
    );
    const copiedElementProperties: Record<string, ElementProperties> = {};
    selectedLayerIds.forEach((id) => {
      if (elementProperties[id]) {
        copiedElementProperties[id] = { ...elementProperties[id] };
      }
    });

    setClipboard({
      layers: copiedLayers,
      elementProperties: copiedElementProperties,
    });

    // OS clipboard (A10): write a JSON round-trip payload + an SVG snapshot so
    // the selection can be pasted into other apps or back in here.
    try {
      const svgString = buildSvgString({ frameSize, elementProperties, layers });
      const payload = JSON.stringify({
        layers: copiedLayers,
        elementProperties: copiedElementProperties,
      });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([svgString], { type: "text/plain" }),
          "application/x-svg-readme": new Blob([payload], {
            type: "application/json",
          }),
        }),
      ]);
    } catch {
      // OS clipboard unavailable — the internal clipboard still works.
    }
  }, [selectedLayerIds, layers, elementProperties, frameSize]);

  // ── Paste from clipboard ───────────────────────────────────────────────────
  const PASTE_OFFSET = 20; // Offset to avoid pasting on top of original

  /**
   * Shared paste flow: remaps ids + parentIds (children of pasted groups stay
   * nested under the pasted group, never the original — A7 nested-layer
   * correctness), offsets positions, appends + selects.
   */
  const applyPaste = useCallback(
    (source: ClipboardState) => {
      if (!source || source.layers.length === 0) return;

      const result = duplicateLayersWithChildren(
        source.layers,
        source.elementProperties,
        source.layers.map((l) => l.id),
        PASTE_OFFSET,
        PASTE_OFFSET,
      );
      if (!result) return;
      const { duplicatedLayers: newLayers, duplicatedProperties: newElementProperties, duplicatedTopIds: newSelectedLayerIds } = result;

      // Save current state to history before pasting
      saveToHistory();

      // Add new layers to existing layers
      setLayers((prev) => [...prev, ...newLayers]);

      // Add new element properties
      setElementProperties((prev) => ({
        ...prev,
        ...newElementProperties,
      }));

      // Select the pasted layers
      setSelectedLayerIds(newSelectedLayerIds);
      setSelectedLayerId(newSelectedLayerIds[0] ?? null);
    },
    [
      saveToHistory,
      setLayers,
      setElementProperties,
      setSelectedLayerIds,
      setSelectedLayerId,
    ],
  );

  /** Paste raw SVG markup as new layers (A10). */
  const pasteSvgMarkup = useCallback(
    (svgText: string) => {
      const result = parseSvgMarkup(svgText);
      if (!result.layers.length) return;
      saveToHistory();
      setLayers((prev) => [
        ...prev.map((l) => ({ ...l, active: false })),
        ...result.layers.map((l) => ({ ...l, active: false })),
      ]);
      setElementProperties((prev) => ({
        ...prev,
        ...result.elementProperties,
      }));
      setSelectedLayerIds([result.layers[0].id]);
      setSelectedLayerId(result.layers[0].id);
    },
    [saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  /** Paste plain text as a new text layer (A10). */
  const pasteAsText = useCallback(
    (text: string) => {
      const tempId = `text-${Date.now()}`;
      const newLayer: LayerType = {
        id: tempId,
        name: "Text",
        type: "text",
        locked: false,
        visible: true,
        active: true,
      };
      const newProps: TextElementProperties = {
        ...DEFAULT_TEXT_PROPS,
        x: 50,
        y: 50,
        width: "auto",
        height: DEFAULT_TEXT_HEIGHT,
        content: text.slice(0, 500),
      };
      saveToHistory();
      setLayers((prev) => [
        ...prev.map((l) => ({ ...l, active: false })),
        newLayer,
      ]);
      setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
      setSelectedLayerIds([tempId]);
      setSelectedLayerId(tempId);
    },
    [saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  /** Paste an image blob as a new image layer (A10). */
  const pasteAsImage = useCallback(
    (blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const tempId = `image-${Date.now()}`;
        const newLayer: LayerType = {
          id: tempId,
          name: "Image",
          type: "image",
          locked: false,
          visible: true,
          active: true,
        };
        const newProps: ImageElementProperties = {
          type: "image",
          x: 50,
          y: 50,
          width: 300,
          height: 150,
          url: dataUrl,
          opacity: 1,
        };
        saveToHistory();
        setLayers((prev) => [
          ...prev.map((l) => ({ ...l, active: false })),
          newLayer,
        ]);
        setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
        setSelectedLayerIds([tempId]);
        setSelectedLayerId(tempId);
      };
      reader.readAsDataURL(blob);
    },
    [saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId],
  );

  /**
   * Paste: prefer the OS clipboard (A10) — our JSON payload → SVG markup →
   * plain text → image — and fall back to the internal clipboard when the OS
   * read is unavailable or yields nothing usable.
   */
  const handlePaste = useCallback(async () => {
    let pasted = false;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("application/x-svg-readme")) {
          const blob = await item.getType("application/x-svg-readme");
          const data = JSON.parse(await blob.text()) as ClipboardState;
          if (data && Array.isArray(data.layers) && data.layers.length > 0) {
            applyPaste(data);
            pasted = true;
          }
          break;
        }
      }
      if (!pasted) {
        for (const item of items) {
          if (item.types.includes("text/plain")) {
            const text = await (await item.getType("text/plain")).text();
            if (/<svg[\s>]/i.test(text)) {
              pasteSvgMarkup(text);
              pasted = true;
            } else if (text.trim()) {
              pasteAsText(text);
              pasted = true;
            }
            break;
          }
          if (!pasted && item.types.includes("image/png")) {
            const blob = await item.getType("image/png");
            pasteAsImage(blob);
            pasted = true;
            break;
          }
        }
      }
    } catch {
      // Permissions denied / read unsupported — use the internal clipboard.
    }
    if (!pasted && clipboard) applyPaste(clipboard);
  }, [clipboard, applyPaste, pasteSvgMarkup, pasteAsText, pasteAsImage]);

  // ── Cut (Ctrl+X): copy to clipboard then delete the selection (A10) ─────
  const handleCut = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    void handleCopy();
    handleDeleteSelectedLayers();
  }, [handleCopy, handleDeleteSelectedLayers, selectedLayerIds]);

  // ── Undo / redo document changes ─────────────────────────────────────────
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

  // ── Layer operations (extracted hook) ──────────────────────────────────
  const layerOps = useLayerOperations({
    documentRef,
    saveToHistory,
    setLayers,
    setElementProperties,
    setSelectedLayerIds,
    setSelectedLayerId,
  });

  const {
    handleDuplicate,
    handleReorderLayers,
    handleGroup,
    handleUngroup,
    handleSmartDelete,
  } = layerOps;

  // ── Layer context menu (merges hook actions + component-level delete) ──
  const handleLayerContextAction = useCallback(
    (actionId: string) => {
      if (actionId === "delete") {
        handleDeleteSelectedLayers();
      } else {
        layerOps.handleLayerContextAction(actionId);
      }
    },
    [handleDeleteSelectedLayers, layerOps],
  );

  // ── Commit text edits (called on blur or Escape) ────────────────────────
  // Figma behavior: both blur and Escape commit the text, nothing "cancels" edits.
  const handleCommitText = useCallback(() => {
    if (!editingLayerId) return;

    // Save current state to history before committing (so undo restores previous content)
    saveToHistory();

    const trimmed = editingContent.trim();

    if (!trimmed) {
      // Empty text → remove the layer entirely
      setLayers((prev) => prev.filter((l) => l.id !== editingLayerId));
      setElementProperties((prev) => {
        const next = { ...prev };
        delete next[editingLayerId];
        return next;
      });
      setSelectedLayerId(null);
    } else {
      // Save the typed content and keep the layer selected
      setElementProperties((prev) => {
        const current = prev[editingLayerId];
        if (!current) return prev;
        // Auto-resize the textbox to hug the content (open-pencil's
        // resizeTextNodeForEdit): WIDTH_AND_HEIGHT sets width from the longest
        // line, HEIGHT/WIDTH_AND_HEIGHT set height from the line count.
        const autoSize =
          current.type === "text"
            ? computeAutoSize(
                {
                  ...current,
                  width:
                    current.width === "auto" ? "auto" : (current.width as number),
                },
                trimmed,
              )
            : {};
        return {
          ...prev,
          [editingLayerId]: {
            ...current,
            content: trimmed,
            ...(autoSize.width !== undefined
              ? { width: autoSize.width }
              : {}),
            ...(autoSize.height !== undefined
              ? { height: autoSize.height }
              : {}),
          },
        };
      });
      setSelectedLayerId(editingLayerId);
    }

    setEditingLayerId(null);
    setEditingContent("");
    setIsEditingText(false);
    setActiveTool("move");
  }, [
    editingLayerId,
    editingContent,
    setLayers,
    setElementProperties,
    setIsEditingText,
    setSelectedLayerId,
    setActiveTool,
    saveToHistory,
  ]);

  // ── Export handler: build SVG and trigger download ──────────────────────
  const handleExport = useCallback(() => {
    const svgString = buildSvgString({
      frameSize,
      elementProperties,
      layers,
    });
    downloadSvg(svgString, "banner.svg");
  }, [frameSize, elementProperties, layers]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    isEditingRef,
    handleCommitText,
    handleCopy,
    handlePaste,
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleReorderLayers,
    handleDeleteSelectedLayers,
    handleGroup,
    handleUngroup,
    handleSmartDelete,
    setActiveTool,
    selectedLayerId,
    selectedLayerIds,
    setSelectedLayerId,
    setSelectedLayerIds,
    setViewport,
    setGridEnabled,
    onMoveStart: handleMoveStart,
    onMoveElement: handleMoveElement,
    handleSave: () => { saveDocument(persistenceDocRef.current); },
    handleExport,
    handleCut,
    onToggleShortcuts: () => setShowShortcuts((s) => !s),
    layers,
    elementProperties,
    selectedVertex,
    onDeleteVertex: handleDeleteVertex,
  });

  // ── Create text element ──────────────────────────────────────────────────
  const handleCreateText = useCallback(
    (x: number, y: number, width: number | "auto", height: number) => {
      const tempId = `text-${Date.now()}`;

      // Create layer
      const newLayer = {
        id: tempId,
        name: "Text",
        type: "text",
        locked: false,
        visible: true,
        active: true,
      };

      // Create element properties (matching Open Pencil defaults)
      const newProps: TextElementProperties = {
        ...DEFAULT_TEXT_PROPS,
        x,
        y,
        width,
        height: width === "auto" ? DEFAULT_TEXT_HEIGHT : height,
        content: "",
      };

      // Deselect all, add layer, set props, enter edit mode
      selectLayer(tempId, false);
      setLayers((prev) =>
        [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev,
      );
      setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
      setEditingLayerId(tempId);
      setEditingContent("");
      setIsEditingText(true);

      setActiveTool("move");

      // Persist to backend (fire-and-forget)
      createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(
        console.error,
      );
    },
    [
      setLayers,
      setElementProperties,
      setIsEditingText,
      setActiveTool,
      selectLayer,
    ],
  );

  // ── Edit existing text ────────────────────────────────────────────────────
  const handleEditText = useCallback(
    (layerId: string) => {
      const props = elementProperties[layerId];
      if (props && props.type === "text") {
        setEditingLayerId(layerId);
        setEditingContent(props.content);
        setIsEditingText(true);
        setSelectedLayerId(layerId);
      }
    },
    [elementProperties, setIsEditingText, setSelectedLayerId],
  );

  // ── Create shape element ────────────────────────────────────────────────────
  const handleCreateShape = useCallback(
    (
      kind: ShapeKind,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const tempId = `shape-${Date.now()}`;

      const kindName = kind.charAt(0).toUpperCase() + kind.slice(1);

      const newLayer: LayerType = {
        id: tempId,
        name: kindName,
        type: "shape",
        locked: false,
        visible: true,
        active: true,
      };

      const newProps: ShapeElementProperties = {
        type: "shape",
        kind,
        x,
        y,
        width,
        height,
        fill: "#8b5cf6",
        stroke: "rgba(255,255,255,0.2)",
        strokeWidth: 1,
        cornerRadius: kind === "rect" ? 8 : undefined,
        opacity: 1,
      };

      saveToHistory();
      selectLayer(tempId, false);
      setLayers((prev) =>
        [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev,
      );
      setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));

      // Switch back to move tool after placing shape (matches Figma UX)
      setActiveTool("move");

      // Persist to backend (fire-and-forget)
      createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(
        console.error,
      );
    },
    [saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool],
  );

  // ── Create path element (pen tool) ─────────────────────────────────────
  const handleCreatePath = useCallback(
    (props: Omit<PathElementProperties, "type">) => {
      const tempId = `path-${Date.now()}`;

      const newLayer: LayerType = {
        id: tempId,
        name: "Path",
        type: "shape",
        locked: false,
        visible: true,
        active: true,
      };

      const newProps: PathElementProperties = {
        type: "path",
        ...props,
      };

      saveToHistory();
      selectLayer(tempId, false);
      setLayers((prev) =>
        [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev,
      );
      setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));

      // Switch back to move tool after drawing path (matches Figma UX)
      setActiveTool("move");

      // Persist to backend (fire-and-forget)
      createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(
        console.error,
      );
    },
    [saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool],
  );

  const handleAlignmentStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  const handlePropertiesStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  // ── Bulk property updates for multi-selections (B10) ─────────────────────
  // Applies the same change to every selected layer, mapping type-specific
  // fields (e.g. "fill" → shape/path fill, text color).
  const handleBulkUpdateProperties = useCallback(
    (updates: Partial<ElementProperties>) => {
      if (selectedLayerIds.length === 0) return;
      saveToHistory();
      setElementProperties((prev) => {
        const next = { ...prev };
        for (const id of selectedLayerIds) {
          const existing = next[id];
          if (!existing) continue;
          let merged: ElementProperties;
          if ("fill" in updates && existing.type === "text") {
            // Text layers have no `fill` — route it to their text color.
            const { fill, ...rest } = updates;
            merged = {
              ...existing,
              ...rest,
              color: (fill as string | undefined) ?? existing.color,
            } as ElementProperties;
          } else {
            merged = { ...existing, ...updates } as ElementProperties;
          }
          next[id] = merged;
        }
        return next;
      });
    },
    [selectedLayerIds, saveToHistory, setElementProperties],
  );

  // ── Resize element ────────────────────────────────────────────────────────
  const handleResizeElement = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setElementProperties((prev) => {
        const props = prev[id];
        if (!props) return prev;
        if (props.type === "path") {
          // Resize the absolute points proportionally so the path matches its new box.
          const { points, handles, bounds, subpaths } = rescalePoints(
            props.points,
            { x: props.x, y: props.y, width: props.width, height: props.height },
            { x, y, width, height },
            props.handles,
            props.subpaths,
          );
          return { ...prev, [id]: { ...props, points, handles, subpaths, ...bounds } };
        }
        return {
          ...prev,
          [id]: {
            ...props,
            x,
            y,
            width,
            height,
          },
        };
      });
    },
    [setElementProperties],
  );

  // ── Resize start (saves state to history) ──────────────────────────────────
  const handleResizeStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  // ── Rotate element ────────────────────────────────────────────────────────
  const handleRotateElement = useCallback(
    (id: string, rotation: number) => {
      setElementProperties((prev) => {
        const props = prev[id];
        if (!props) return prev;
        return {
          ...prev,
          [id]: {
            ...props,
            rotation,
          },
        };
      });
    },
    [setElementProperties],
  );

  // ── Rotate start (saves state to history) ──────────────────────────────────
  const handleRotateStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);
  // ── Tool change handler (commits text if editing, then switches) ──────────
  const handleToolChange = useCallback(
    (tool: EditorTool) => {
      if (isEditingText) {
        handleCommitText();
      }
      if (tool === "image") {
        // Trigger the hidden file input instead of switching tool
        imageInputRef.current?.click();
        return;
      }
      setActiveTool(tool);
    },
    [isEditingText, handleCommitText, setActiveTool],
  );

  // ── Image file selected from the file picker ──────────────────────────────
  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Read the natural dimensions so we can fit the image on canvas
        const img = new window.Image();
        img.onload = () => {
          const maxW = frameSize.width * 0.6;
          const maxH = frameSize.height * 0.6;
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          // Scale down while preserving aspect ratio
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          // Center on canvas
          const x = Math.round((frameSize.width - w) / 2);
          const y = Math.round((frameSize.height - h) / 2);

          const tempId = `image-${Date.now()}`;
          const newLayer: LayerType = {
            id: tempId,
            name: file.name.replace(/\.[^.]+$/, "") || "Image",
            type: "image",
            locked: false,
            visible: true,
            active: true,
          };

          const newProps: ImageElementProperties = {
            type: "image",
            x,
            y,
            width: w,
            height: h,
            url: dataUrl,
            opacity: 1,
          };

          saveToHistory();
          selectLayer(tempId, false);
          setLayers((prev) =>
            [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev,
          );
          setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
          setActiveTool("move");

          // Persist to backend (fire-and-forget)
          createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(
            console.error,
          );
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);

      // Reset the input so the same file can be selected again
      e.target.value = "";
    },
    [frameSize, saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool],
  );

  // ── Update properties for the selected element ────────────────────────────
  const handleUpdateProperties = useCallback(
    (id: string, updates: Partial<ElementProperties>) => {
      setElementProperties((prev) => {
        const existing = prev[id];
        if (!existing) return prev;
        // A path's geometry lives in absolute points — box-only updates (the
        // Design panel's X/Y/W/H inputs) must translate/rescale the points too,
        // or only the selection box would move while the path stays put.
        if (
          existing.type === "path" &&
          ("x" in updates || "y" in updates || "width" in updates || "height" in updates)
        ) {
          const nextBox = {
            x: typeof updates.x === "number" ? updates.x : existing.x,
            y: typeof updates.y === "number" ? updates.y : existing.y,
            width: typeof updates.width === "number" ? updates.width : existing.width,
            height: typeof updates.height === "number" ? updates.height : existing.height,
          };
          const { points, handles, bounds, subpaths } = rescalePoints(
            existing.points,
            { x: existing.x, y: existing.y, width: existing.width, height: existing.height },
            nextBox,
            existing.handles,
            existing.subpaths,
          );
          return {
            ...prev,
            [id]: {
              ...existing,
              ...updates,
              points,
              handles,
              subpaths,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            } as ElementProperties,
          };
        }
        return {
          ...prev,
          [id]: { ...existing, ...updates } as ElementProperties,
        };
      });
    },
    [setElementProperties],
  );

  // ── Select layer (Figma: single-click selects the layer) ────────────────
  // NOTE: selectLayer/clearSelection in the context already sync layer active
  // flags, so we don't need to call setLayers here.
  const handleSelectLayer = useCallback(
    (id: string | null) => {
      if (id) {
        selectLayer(id, false);
      } else {
        clearSelection();
      }
    },
    [selectLayer, clearSelection],
  );

  // ── Shift+click layer — toggle in multi-select ──────────────────────────
  const handleShiftSelectLayer = useCallback(
    (id: string) => {
      selectLayer(id, true);
    },
    [selectLayer],
  );

  // ── Clear all selection (click on empty canvas) ─────────────────────────
  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // ── SVG file import via drag-and-drop ──────────────────────────────────
  const { isDragOver, handleDragOver, handleDragEnter, handleDragLeave, handleDrop } =
    useSvgImport({ saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId });

  // ── Path vertex editing: move a single vertex of a path ──────────────
  useEffect(() => {
    const handleVertexMove = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        elementId: string;
        vertexIndex: number;
        x: number;
        y: number;
      };
      // History is recorded once per drag via path-vertex-drag-start.
      setElementProperties((prev) => {
        const props = prev[detail.elementId];
        if (!props || props.type !== "path") return prev;
        if (
          detail.vertexIndex < 0 ||
          detail.vertexIndex >= props.points.length
        ) {
          return prev;
        }
        const [ox, oy] = props.points[detail.vertexIndex];
        const dx = detail.x - ox;
        const dy = detail.y - oy;
        const newPoints = [...props.points] as [number, number][];
        newPoints[detail.vertexIndex] = [detail.x, detail.y];
        // Control handles attached to the anchor travel with it (Figma behavior).
        const handles = shiftVertexHandles(props.handles, detail.vertexIndex, dx, dy);
        const bounds = computePathBounds(newPoints);
        return {
          ...prev,
          [detail.elementId]: {
            ...props,
            points: newPoints,
            handles,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
        };
      });
    };
    window.addEventListener("path-vertex-move", handleVertexMove);
    return () => window.removeEventListener("path-vertex-move", handleVertexMove);
  }, [setElementProperties]);

  // ── Node selection + one history entry per drag ────────────────────────
  useEffect(() => {
    const handleSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        layerId: string;
        vertexIndex: number;
      };
      setSelectedVertex({ layerId: detail.layerId, index: detail.vertexIndex });
    };
    const handleDragStart = () => {
      saveToHistory();
    };
    window.addEventListener("path-vertex-select", handleSelect);
    window.addEventListener("path-vertex-drag-start", handleDragStart);
    return () => {
      window.removeEventListener("path-vertex-select", handleSelect);
      window.removeEventListener("path-vertex-drag-start", handleDragStart);
    };
  }, [saveToHistory]);

  // ── Drag a bezier handle (mirrors the opposite handle on smooth points) ──
  useEffect(() => {
    const handleHandleMove = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        elementId: string;
        vertexIndex: number;
        side: "in" | "out";
        x: number;
        y: number;
      };
      setElementProperties((prev) => {
        const props = prev[detail.elementId];
        if (!props || props.type !== "path") return prev;
        const n = props.points.length;
        if (detail.vertexIndex < 0 || detail.vertexIndex >= n) return prev;
        const anchor = props.points[detail.vertexIndex];
        const handles = props.handles
          ? props.handles.map((h) => (h ? { ...h } : undefined))
          : (new Array(n).fill(undefined) as (PathVertexHandle | undefined)[]);
        const current = handles[detail.vertexIndex] ?? {};
        const nextHandle = { ...current };
        const point: [number, number] = [detail.x, detail.y];
        if (detail.side === "in") {
          nextHandle.in = point;
          if (nextHandle.smooth) nextHandle.out = mirrorPoint(point, anchor);
        } else {
          nextHandle.out = point;
          if (nextHandle.smooth) nextHandle.in = mirrorPoint(point, anchor);
        }
        handles[detail.vertexIndex] = nextHandle;
        return { ...prev, [detail.elementId]: { ...props, handles } };
      });
    };
    window.addEventListener("path-handle-move", handleHandleMove);
    return () => window.removeEventListener("path-handle-move", handleHandleMove);
  }, [setElementProperties]);

  // ── Insert a node at a segment's midpoint (de Casteljau split) ──────────
  useEffect(() => {
    const handleNodeAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        layerId: string;
        segmentIndex: number;
      };
      saveToHistory();
      // The split shifts indices ≥ segmentIndex+1 — drop any stale node selection.
      setSelectedVertex(null);
      setElementProperties((prev) => {
        const props = prev[detail.layerId];
        if (!props || props.type !== "path") return prev;
        const n = props.points.length;
        const maxSeg = props.closed ? n : n - 1;
        if (detail.segmentIndex < 0 || detail.segmentIndex >= maxSeg) return prev;
        const { points, handles } = splitSegment(
          props.points,
          props.handles,
          detail.segmentIndex,
          props.closed,
        );
        const bounds = computePathBounds(points);
        return {
          ...prev,
          [detail.layerId]: {
            ...props,
            points,
            handles,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
        };
      });
    };
    window.addEventListener("path-node-add", handleNodeAdd);
    return () => window.removeEventListener("path-node-add", handleNodeAdd);
  }, [saveToHistory, setElementProperties]);

  // ── Convert a node corner ↔ smooth (Alt-click / double-click on anchor) ──
  useEffect(() => {
    const handleConvert = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        layerId: string;
        vertexIndex: number;
      };
      saveToHistory();
      setElementProperties((prev) => {
        const props = prev[detail.layerId];
        if (!props || props.type !== "path") return prev;
        const handles = toggleVertexSmooth(
          props.points,
          props.handles,
          detail.vertexIndex,
        );
        return { ...prev, [detail.layerId]: { ...props, handles } };
      });
    };
    window.addEventListener("path-vertex-convert", handleConvert);
    return () => window.removeEventListener("path-vertex-convert", handleConvert);
  }, [saveToHistory, setElementProperties]);


  // ── Listen for custom copy/export events from EditorRightBar ───────────
  useEffect(() => {
    /** Map Export-tab options → buildSvgString options (A12/E). */
    const toBuildOptions = (opts?: Partial<ExportOptions>) => {
      if (!opts) return {};
      return {
        backgroundColor: opts.transparent
          ? "transparent"
          : (opts.backgroundColor ?? "#09090b"),
        rounded: opts.rounded,
        borderRadius: opts.borderRadius,
        showBorder: opts.showBorder,
      };
    };
    const readOptions = (e: Event): Partial<ExportOptions> | undefined =>
      (e as CustomEvent).detail?.options;

    const handleCopySvg = (e: Event) => {
      const data = exportDataRef.current;
      const opts = readOptions(e);
      const svgString = buildSvgString({ ...data, ...toBuildOptions(opts) });
      copySvgText(svgString).catch(console.error);
    };

    const handleCopyMd = (e: Event) => {
      const opts = readOptions(e);
      copyMarkdown(`${opts?.filename ?? "banner"}.svg`).catch(console.error);
    };

    const handleExportPng = (e: Event) => {
      const data = exportDataRef.current;
      const opts = readOptions(e);
      downloadPng(
        data.frameSize,
        data.elementProperties,
        data.layers,
        `${opts?.filename ?? "banner"}.png`,
        { scale: opts?.pngScale ?? 2, ...toBuildOptions(opts) },
      ).catch(console.error);
    };

    const handleCopyImage = (e: Event) => {
      const data = exportDataRef.current;
      const opts = readOptions(e);
      const svgString = buildSvgString({ ...data, ...toBuildOptions(opts) });
      copyImageToClipboard(
        svgString,
        data.frameSize.width,
        data.frameSize.height,
        data.elementProperties,
        opts?.pngScale ?? 2,
      ).catch(console.error);
    };

    window.addEventListener("copy-svg-code", handleCopySvg);
    window.addEventListener("copy-markdown", handleCopyMd);
    window.addEventListener("export-png", handleExportPng);
    window.addEventListener("copy-png-image", handleCopyImage);

    const handleExportAnimated = (e: Event) => {
      const { fps, format } = (e as CustomEvent).detail as { fps: number; format: "gif" | "png-sequence" };
      const data = exportDataRef.current;
      const dispatchProgress = (current: number, total: number) => {
        window.dispatchEvent(new CustomEvent("export-animated-progress", {
          detail: { current, total },
        }));
      };
      (async () => {
        try {
          const result = await exportAnimated(
            { frameSize: data.frameSize, elementProperties: data.elementProperties, layers: data.layers, fps, format },
            (current, total) => dispatchProgress(current, total),
            () => {},
          );
          if (result.gifBlob) {
            downloadGif(result.gifBlob, "banner.gif");
            dispatchProgress(1, 1);
          }
        } catch (err) {
          console.error("Animated export failed:", err);
          dispatchProgress(0, 0);
        }
      })();
    };
    window.addEventListener("export-animated", handleExportAnimated);

    return () => {
      window.removeEventListener("copy-svg-code", handleCopySvg);
      window.removeEventListener("copy-markdown", handleCopyMd);
      window.removeEventListener("export-png", handleExportPng);
      window.removeEventListener("copy-png-image", handleCopyImage);
      window.removeEventListener("export-animated", handleExportAnimated);
    };
  }, []);

  // ── Shortcut cheat-sheet toggled from the navbar (A16/B5) ────────────────
  useEffect(() => {
    const handler = () => setShowShortcuts((s) => !s);
    window.addEventListener("toggle-shortcuts", handler);
    return () => window.removeEventListener("toggle-shortcuts", handler);
  }, []);

  // ── Rubber-band multi-select (drag on empty canvas) ──────────────────────
  const handleRubberBandSelect = useCallback(
    (ids: string[], addToExisting: boolean) => {
      if (addToExisting) {
        // Shift+drag: add rubber-band elements to existing selection.
        // Compute next state outside setState to avoid StrictMode double-invoke issues.
        setSelectedLayerIds((prev) => {
          const next = [...new Set([...prev, ...ids])];
          // Batch all state updates together — compute active flags immediately
          // rather than nesting setState calls inside the updater.
          queueMicrotask(() => {
            setSelectedLayerId(next[0] ?? null);
            setLayers((prevLayers) =>
              prevLayers.map((l) => ({ ...l, active: next.includes(l.id) })),
            );
          });
          return next;
        });
      } else {
        // Normal drag: replace selection with rubber-band elements
        setSelectedLayerIds(ids);
        setSelectedLayerId(ids[0] ?? null);
        setLayers((prevLayers) =>
          prevLayers.map((l) => ({ ...l, active: ids.includes(l.id) })),
        );
      }
    },
    [setSelectedLayerIds, setSelectedLayerId, setLayers],
  );

  const fitViewport = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const padding = 96;
    const availableWidth = Math.max(workspace.clientWidth - padding, 1);
    const availableHeight = Math.max(workspace.clientHeight - padding, 1);
    const zoom = clampZoom(Math.min(
      availableWidth / frameSize.width,
      availableHeight / frameSize.height,
    ));
    setViewport({
      zoom,
      panX: (workspace.clientWidth - frameSize.width * zoom) / 2,
      panY: (workspace.clientHeight - frameSize.height * zoom) / 2,
    });
  }, [frameSize]);

  useEffect(() => {
    if (!isProjectActive) return;
    fitViewport();
    const workspace = workspaceRef.current;
    if (!workspace || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fitViewport);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [fitViewport, isProjectActive]);

  // ── Unsaved-changes guard: warn before leaving page ────────────────────
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  useEffect(() => {
    if (!isProjectActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isProjectActive]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isProjectActive) {
    return (
      <EditorLayout
        frameSize={frameSize}
        setFrameSize={setFrameSize}
        onToolSelect={handleToolChange}
        onExport={handleExport}
        onNewProject={handleNewProject}
        isProjectActive={isProjectActive}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onLayerContextAction={handleLayerContextAction}
        documentRef={persistenceDocRef}
      >
        <div className="relative w-full h-full flex items-center justify-center p-12 overflow-hidden">
          <div className="bg-zinc-900 border border-white/10 p-8 w-full max-w-md rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col gap-6 z-30">
            <div>
              <h2 className="text-xl font-semibold text-white font-[Poppins]">
                Create a new banner
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Get started by creating a blank canvas or picking a standard
                template.
              </p>
            </div>

            {/* Custom size inputs */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Custom Dimensions
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-zinc-950 border border-white/5 rounded-md px-3 py-2">
                  <span className="text-zinc-500 text-xs font-mono">W</span>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="bg-transparent text-sm w-full outline-none text-zinc-300 focus:text-white"
                  />
                </div>
                <div className="flex items-center gap-2 bg-zinc-950 border border-white/5 rounded-md px-3 py-2">
                  <span className="text-zinc-500 text-xs font-mono">H</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="bg-transparent text-sm w-full outline-none text-zinc-300 focus:text-white"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const w = parseInt(customWidth) || 800;
                  const h = parseInt(customHeight) || 200;
                  setFrameSize({ width: w, height: h });
                  setIsProjectActive(true);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-md shadow-lg shadow-blue-500/20 transition-all cursor-pointer border border-blue-500/50"
              >
                Create Blank Canvas
              </button>
            </div>

            <div className="h-px bg-white/5" />

            {/* Predefined Templates */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Templates
              </span>
              <div className="flex flex-col gap-2">
                {[
                  {
                    name: "Standard Banner",
                    desc: "Recommended for profiles",
                    w: 800,
                    h: 200,
                  },
                  {
                    name: "Wide Profile Banner",
                    desc: "Fits wide layouts",
                    w: 1000,
                    h: 220,
                  },
                  {
                    name: "Compact Banner",
                    desc: "Perfect for tight spaces",
                    w: 640,
                    h: 160,
                  },
                ].map((t) => (
                  <button
                    key={t.name}
                    onClick={() => {
                      setFrameSize({ width: t.w, height: t.h });
                      setIsProjectActive(true);
                    }}
                    className="flex justify-between items-center bg-zinc-950 hover:bg-zinc-800/80 p-3 rounded-md border border-white/5 transition-all text-left group cursor-pointer"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                        {t.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500">{t.desc}</p>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded">
                      {t.w} × {t.h}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </EditorLayout>
    );
  }

  return (
    <EditorLayout
      frameSize={frameSize}
      setFrameSize={setFrameSize}
      onToolSelect={handleToolChange}
      onExport={handleExport}
      onNewProject={handleNewProject}
      isProjectActive={isProjectActive}
      canUndo={history.past.length > 0}
      canRedo={history.future.length > 0}
      onUndo={handleUndo}
      onRedo={handleRedo}
      selectedLayerIds={selectedLayerIds}
      elementProperties={elementProperties}
      onUpdateProperties={handleUpdateProperties}
      onBulkUpdateProperties={handleBulkUpdateProperties}
      onPropertiesStart={handlePropertiesStart}
      onMoveElement={handleMoveElement}
      onAlignmentStart={handleAlignmentStart}
      onLayerContextAction={handleLayerContextAction}
      documentRef={persistenceDocRef}
    >
      {/* Canvas Area wrapper for zoom/pan context */}
      <div
        ref={workspaceRef}
        className="relative w-full h-full flex items-start justify-start overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop overlay when dragging SVG files */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-2xl flex items-center justify-center pointer-events-none">
            <div className="bg-zinc-900/90 border border-blue-500/30 rounded-xl px-6 py-4 shadow-2xl">
              <p className="text-sm font-medium text-blue-400">Drop SVG file to import</p>
            </div>
          </div>
        )}
        {/* The actual SVG Canvas/Artboard */}
        <div className="relative group">
          <Canvas
            frameSize={frameSize}
            activeTool={activeTool}
            layers={layers}
            selectedLayerId={selectedLayerId}
            selectedLayerIds={selectedLayerIds}
            isEditingText={isEditingText}
            elementProperties={elementProperties}
            onCreateText={handleCreateText}
            onCreateShape={handleCreateShape}
            onCreatePath={handleCreatePath}
            onSelectLayer={handleSelectLayer}
            onShiftSelectLayer={handleShiftSelectLayer}
            onClearSelection={handleClearSelection}
            onRubberBandSelect={handleRubberBandSelect}
            onMoveStart={handleMoveStart}
            onMoveElement={handleMoveElement}
            onResizeStart={handleResizeStart}
            onResizeElement={handleResizeElement}
            onRotateStart={handleRotateStart}
            onRotateElement={handleRotateElement}
            onEditingChange={setIsEditingText}
            onEditText={handleEditText}
            editingContent={editingContent}
            editingLayerId={editingLayerId}
            onEditingContentChange={setEditingContent}
            onCommitText={handleCommitText}
            viewport={viewport}
            onViewportChange={setViewport}
            gridEnabled={gridEnabled}
            snapEnabled={snapEnabled}
            gridSize={10}
            previewAnimation={previewAnimation}
            scrubTime={scrubTime}
            selectedVertex={selectedVertex}
          />
        </div>

        <ViewportControls
          zoom={viewport.zoom}
          gridEnabled={gridEnabled}
          snapEnabled={snapEnabled}
          onZoomIn={() => setViewport((current) => {
            const ws = workspaceRef.current;
            const wsW = ws?.clientWidth ?? 0;
            const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(current.zoom * 1.1);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom;
            const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
          onZoomOut={() => setViewport((current) => {
            const ws = workspaceRef.current;
            const wsW = ws?.clientWidth ?? 0;
            const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(current.zoom * 0.9);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom;
            const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
          onFit={fitViewport}
          onToggleGrid={() => setGridEnabled((enabled) => !enabled)}
          onToggleSnap={() => setSnapEnabled((enabled) => !enabled)}
          onZoomTo={(z) => setViewport((current) => {
            const ws = workspaceRef.current;
            const wsW = ws?.clientWidth ?? 0;
            const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(z);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom;
            const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
        />
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />

      {/* Shortcut cheat-sheet popover (Ctrl+/ or ?) */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-[580px] max-h-[80vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-zinc-100 font-[Poppins]">
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-7 h-7 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                aria-label="Close shortcuts"
              >
                ✕
              </button>
            </div>
            <ShortcutGrid />
          </div>
        </div>
      )}
    </EditorLayout>
  );
}

