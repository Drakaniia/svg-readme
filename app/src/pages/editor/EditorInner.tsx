import { useEffect, useCallback, useRef, useState } from "react";
import { clampZoom } from "../../lib/editor/geometry";
import { startPan, updatePan } from "../../lib/editor-tools/PanZoomHandler";
import ViewportControls from "../../components/editor-canvas/ViewportControls";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useLayerOperations } from "./useLayerOperations";
import { useSvgImport } from "./useSvgImport";
import EditorLayout from "../../layouts/EditorLayout";
import { useEditor } from "../../context/EditorContext";
import type { EditorTool, LayerType } from "../../context/EditorContext";
import Canvas from "../../components/editor-canvas/Canvas";
import type { TextElementProperties, ShapeElementProperties, ImageElementProperties, PathElementProperties, ElementProperties, ShapeKind } from "../../components/editor-canvas/ElementsRenderer";
import { rescalePoints } from "../../lib/editor/pathUtils";
import { DEFAULT_TEXT_PROPS, DEFAULT_TEXT_HEIGHT } from "../../components/editor-canvas/types";
import { computeAutoSize } from "../../lib/editor/textMeasure";
import { createLayer } from "../../lib/api";
import { ShortcutGrid } from "./EditorInnerShortcuts";

// ── Extracted hooks ───────────────────────────────────────────────────────────
import { useEditorHistory } from "./hooks/useEditorHistory";
import { useEditorClipboard } from "./hooks/useEditorClipboard";
import { useEditorExport } from "./hooks/useEditorExport";
import { useEditorPersistence } from "./hooks/useEditorPersistence";
import { usePathVertexEditing } from "./hooks/usePathVertexEditing";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMP_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

// ─── Inner component that uses context ────────────────────────────────────────

export function EditorInner() {
  const {
    activeTool,
    setActiveTool,
    selectedShapeKind,
    setSelectedShapeKind,
    paintColor,
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
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [workspacePanning, setWorkspacePanning] = useState(false);
  const workspacePanStateRef = useRef<{
    startX: number; startY: number; initialPanX: number; initialPanY: number;
  } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  // ── Refs ─────────────────────────────────────────────────────────────────
  const isEditingRef = useRef(false);
  useEffect(() => { isEditingRef.current = isEditingText; }, [isEditingText]);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // documentRef: shared snapshot source for history + layer operations
  const documentRef = useRef({ layers, elementProperties, selectedLayerIds });
  useEffect(() => {
    documentRef.current = { layers, elementProperties, selectedLayerIds };
  }, [layers, elementProperties, selectedLayerIds]);

  // ── Extracted hooks ──────────────────────────────────────────────────────
  const { history, setHistory, saveToHistory, handleUndo, handleRedo } =
    useEditorHistory({ documentRef, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId });

  const { handleCopy, handlePaste } =
    useEditorClipboard({ selectedLayerIds, layers, elementProperties, frameSize, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId });

  const { handleExport } =
    useEditorExport({ frameSize, elementProperties, layers });

  const { persistenceDocRef, handleNewProject, handleSave } =
    useEditorPersistence({
      isProjectActive, layers, elementProperties, frameSize,
      setLayers, setElementProperties, setFrameSize, setCurrentProjectId,
      setProjectName, setIsProjectActive, setSelectedLayerId, setSelectedLayerIds,
      markClean, setHistory,
    });

  // ── Path vertex editing (extracted hook) ──────────────────────────────
  const { selectedVertex, setSelectedVertex, handleMoveStart, handleMoveElement, handleDeleteVertex } =
    usePathVertexEditing({ saveToHistory, setElementProperties });

  // ── Node selection clear on tool change ──────────────────────────────────
  useEffect(() => {
    if (!selectedVertex) return;
    if (
      activeTool !== "move" ||
      !selectedLayerIds.includes(selectedVertex.layerId)
    ) {
      setSelectedVertex(null);
    }
  }, [activeTool, selectedLayerIds, selectedVertex, setSelectedVertex]);

  useEffect(() => {
    const handler = () => setShowShortcuts((s) => !s);
    window.addEventListener("toggle-shortcuts", handler);
    return () => window.removeEventListener("toggle-shortcuts", handler);
  }, []);

  // ── Delete selected layers ────────────────────────────────────────────────
  const handleDeleteSelectedLayers = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    if (selectedLayerIds.some((id) => layers.find((l) => l.id === id)?.locked)) return;
    saveToHistory();
    const idsToDelete = new Set(selectedLayerIds);
    const collectDescendants = (parentId: string) => {
      layers.forEach((l) => {
        if ((l.parentId ?? null) === parentId) { idsToDelete.add(l.id); collectDescendants(l.id); }
      });
    };
    [...idsToDelete].forEach((id) => collectDescendants(id));
    setLayers((prev) => prev.filter((l) => !idsToDelete.has(l.id)));
    setElementProperties((prev) => {
      const next = { ...prev };
      idsToDelete.forEach((id) => delete next[id]);
      return next;
    });
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
  }, [selectedLayerIds, layers, setLayers, setElementProperties, setSelectedLayerId, setSelectedLayerIds, saveToHistory]);

  // ── Cut (Ctrl+X) ─────────────────────────────────────────────────────────
  const handleCut = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    void handleCopy();
    handleDeleteSelectedLayers();
  }, [handleCopy, handleDeleteSelectedLayers, selectedLayerIds]);

  // ── Layer operations (extracted hook) ────────────────────────────────────
  const layerOps = useLayerOperations({
    documentRef, saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId,
  });

  const handleLayerContextAction = useCallback(
    (actionId: string) => {
      if (actionId === "delete") handleDeleteSelectedLayers();
      else layerOps.handleLayerContextAction(actionId);
    },
    [handleDeleteSelectedLayers, layerOps],
  );

  // ── Commit text edits ────────────────────────────────────────────────────
  const handleCommitText = useCallback(() => {
    if (!editingLayerId) return;
    saveToHistory();
    const trimmed = editingContent.trim();
    if (!trimmed) {
      setLayers((prev) => prev.filter((l) => l.id !== editingLayerId));
      setElementProperties((prev) => { const next = { ...prev }; delete next[editingLayerId]; return next; });
      setSelectedLayerId(null);
    } else {
      setElementProperties((prev) => {
        const current = prev[editingLayerId];
        if (!current) return prev;
        const autoSize = current.type === "text"
          ? computeAutoSize({ ...current, width: current.width === "auto" ? "auto" : (current.width as number) }, trimmed)
          : {};
        return {
          ...prev,
          [editingLayerId]: {
            ...current, content: trimmed,
            ...(autoSize.width !== undefined ? { width: autoSize.width } : {}),
            ...(autoSize.height !== undefined ? { height: autoSize.height } : {}),
          },
        };
      });
      setSelectedLayerId(editingLayerId);
    }
    setEditingLayerId(null);
    setEditingContent("");
    setIsEditingText(false);
    setActiveTool("move");
  }, [editingLayerId, editingContent, setLayers, setElementProperties, setIsEditingText, setSelectedLayerId, setActiveTool, saveToHistory]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    isEditingRef, handleCommitText, handleCopy, handlePaste, handleUndo, handleRedo,
    handleDuplicate: layerOps.handleDuplicate,
    handleReorderLayers: layerOps.handleReorderLayers,
    handleDeleteSelectedLayers,
    handleGroup: layerOps.handleGroup,
    handleUngroup: layerOps.handleUngroup,
    handleSmartDelete: layerOps.handleSmartDelete,
    setActiveTool, selectedShapeKind, setSelectedShapeKind, activeTool,
    selectedLayerId, selectedLayerIds, setSelectedLayerId, setSelectedLayerIds,
    setViewport, setGridEnabled,
    onMoveStart: handleMoveStart,
    onMoveElement: handleMoveElement,
    handleSave,
    handleExport,
    handleCut,
    onToggleShortcuts: () => setShowShortcuts((s) => !s),
    layers, elementProperties,
    selectedVertex,
    onDeleteVertex: handleDeleteVertex,
  });

  // ── Create text element ──────────────────────────────────────────────────
  const handleCreateText = useCallback((x: number, y: number, width: number | "auto", height: number) => {
    const tempId = `text-${Date.now()}`;
    const newLayer = { id: tempId, name: "Text", type: "text" as const, locked: false, visible: true, active: true };
    const newProps: TextElementProperties = { ...DEFAULT_TEXT_PROPS, x, y, width, height: width === "auto" ? DEFAULT_TEXT_HEIGHT : height, content: "" };
    selectLayer(tempId, false);
    setLayers((prev) => [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev);
    setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
    setEditingLayerId(tempId);
    setEditingContent("");
    setIsEditingText(true);
    setActiveTool("move");
    createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(console.error);
  }, [setLayers, setElementProperties, setIsEditingText, setActiveTool, selectLayer]);

  const handleEditText = useCallback((layerId: string) => {
    const props = elementProperties[layerId];
    if (props && props.type === "text") {
      setEditingLayerId(layerId);
      setEditingContent(props.content);
      setIsEditingText(true);
      setSelectedLayerId(layerId);
    }
  }, [elementProperties, setIsEditingText, setSelectedLayerId]);

  // ── Create shape element ─────────────────────────────────────────────────
  const handleCreateShape = useCallback((kind: ShapeKind, x: number, y: number, width: number, height: number) => {
    const tempId = `shape-${Date.now()}`;
    const kindName = kind.charAt(0).toUpperCase() + kind.slice(1);
    const newLayer: LayerType = { id: tempId, name: kindName, type: "shape", locked: false, visible: true, active: true };
    const newProps: ShapeElementProperties = {
      type: "shape", kind, x, y, width, height, fill: "#8b5cf6", stroke: "rgba(255,255,255,0.2)", strokeWidth: 1,
      cornerRadius: kind === "rect" ? 8 : undefined, opacity: 1,
    };
    saveToHistory();
    selectLayer(tempId, false);
    setLayers((prev) => [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev);
    setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
    setActiveTool("move");
    createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(console.error);
  }, [saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool]);

  // ── Create path element ──────────────────────────────────────────────────
  const handleCreatePath = useCallback((props: Omit<PathElementProperties, "type">) => {
    const tempId = `path-${Date.now()}`;
    const newLayer: LayerType = { id: tempId, name: "Path", type: "shape", locked: false, visible: true, active: true };
    const newProps: PathElementProperties = { type: "path", ...props };
    saveToHistory();
    selectLayer(tempId, false);
    setLayers((prev) => [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev);
    setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
    setActiveTool("move");
    createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(console.error);
  }, [saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool]);

  const handleAlignmentStart = useCallback(() => { saveToHistory(); }, [saveToHistory]);
  const handlePropertiesStart = useCallback(() => { saveToHistory(); }, [saveToHistory]);

  // ── Bulk property updates for multi-selections (B10) ─────────────────────
  const handleBulkUpdateProperties = useCallback((updates: Partial<ElementProperties>) => {
    if (selectedLayerIds.length === 0) return;
    saveToHistory();
    setElementProperties((prev) => {
      const next = { ...prev };
      for (const id of selectedLayerIds) {
        const existing = next[id];
        if (!existing) continue;
        let merged: ElementProperties;
        if ("fill" in updates && existing.type === "text") {
          const { fill, ...rest } = updates;
          merged = { ...existing, ...rest, color: (fill as string | undefined) ?? existing.color } as ElementProperties;
        } else {
          merged = { ...existing, ...updates } as ElementProperties;
        }
        next[id] = merged;
      }
      return next;
    });
  }, [selectedLayerIds, saveToHistory, setElementProperties]);

  // ── Resize ────────────────────────────────────────────────────────────────
  const handleResizeElement = useCallback((id: string, x: number, y: number, width: number, height: number) => {
    setElementProperties((prev) => {
      const props = prev[id];
      if (!props) return prev;
      if (props.type === "path") {
        const { points, handles, bounds, subpaths } = rescalePoints(
          props.points, { x: props.x, y: props.y, width: props.width, height: props.height },
          { x, y, width, height }, props.handles, props.subpaths,
        );
        return { ...prev, [id]: { ...props, points, handles, subpaths, ...bounds } };
      }
      return { ...prev, [id]: { ...props, x, y, width, height } };
    });
  }, [setElementProperties]);

  const handleResizeStart = useCallback(() => { saveToHistory(); }, [saveToHistory]);

  // ── Rotate ────────────────────────────────────────────────────────────────
  const handleRotateElement = useCallback((id: string, rotation: number) => {
    setElementProperties((prev) => {
      const props = prev[id];
      if (!props) return prev;
      return { ...prev, [id]: { ...props, rotation } };
    });
  }, [setElementProperties]);

  const handleRotateStart = useCallback(() => { saveToHistory(); }, [saveToHistory]);

  // ── Paint bucket ─────────────────────────────────────────────────────────
  const handlePaintLayer = useCallback((layerId: string, color: string) => {
    const props = elementProperties[layerId];
    if (!props) return;
    if (props.type === "path") {
      if (props.fill === color) return;
      saveToHistory();
      setElementProperties((prev) => ({ ...prev, [layerId]: { ...props, fill: color } }));
    } else if (props.type === "shape") {
      const paintProp: "fill" | "stroke" = props.kind === "line" ? "stroke" : "fill";
      const current = props[paintProp];
      if (current === color) return;
      saveToHistory();
      setElementProperties((prev) => ({ ...prev, [layerId]: { ...props, [paintProp]: color } }));
    } else if (props.type === "text") {
      if (props.color === color) return;
      saveToHistory();
      setElementProperties((prev) => ({ ...prev, [layerId]: { ...props, color } }));
    }
  }, [elementProperties, saveToHistory, setElementProperties]);

  // ── Tool change handler ──────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: EditorTool) => {
    if (isEditingText) handleCommitText();
    if (tool === "image") { imageInputRef.current?.click(); return; }
    // Legacy shape names (pre-phase2) are mapped to grouped shape tool
    const legacyShapes = new Set(["rect", "circle", "triangle", "star", "hexagon", "line"]);
    if (legacyShapes.has(tool as string)) {
      setSelectedShapeKind(tool as unknown as typeof selectedShapeKind);
      setActiveTool("shape");
      return;
    }
    setActiveTool(tool);
  }, [isEditingText, handleCommitText, setActiveTool, setSelectedShapeKind]);

  // ── Image file selected ──────────────────────────────────────────────────
  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxW = frameSize.width * 0.6;
        const maxH = frameSize.height * 0.6;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW || h > maxH) { const ratio = Math.min(maxW / w, maxH / h); w = Math.round(w * ratio); h = Math.round(h * ratio); }
        const x = Math.round((frameSize.width - w) / 2);
        const y = Math.round((frameSize.height - h) / 2);
        const tempId = `image-${Date.now()}`;
        const newLayer: LayerType = { id: tempId, name: file.name.replace(/\.[^.]+$/, "") || "Image", type: "image", locked: false, visible: true, active: true };
        const newProps: ImageElementProperties = { type: "image", x, y, width: w, height: h, url: dataUrl, opacity: 1 };
        saveToHistory();
        selectLayer(tempId, false);
        setLayers((prev) => [...prev.map((l) => ({ ...l, active: false })), newLayer] as typeof prev);
        setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));
        setActiveTool("move");
        createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(console.error);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [frameSize, saveToHistory, selectLayer, setLayers, setElementProperties, setActiveTool]);

  // ── Update properties ────────────────────────────────────────────────────
  const handleUpdateProperties = useCallback((id: string, updates: Partial<ElementProperties>) => {
    setElementProperties((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      if (existing.type === "path" && ("x" in updates || "y" in updates || "width" in updates || "height" in updates)) {
        const nextBox = {
          x: typeof updates.x === "number" ? updates.x : existing.x,
          y: typeof updates.y === "number" ? updates.y : existing.y,
          width: typeof updates.width === "number" ? updates.width : existing.width,
          height: typeof updates.height === "number" ? updates.height : existing.height,
        };
        const { points, handles, bounds, subpaths } = rescalePoints(
          existing.points,
          { x: existing.x, y: existing.y, width: existing.width, height: existing.height },
          nextBox, existing.handles, existing.subpaths,
        );
        return { ...prev, [id]: { ...existing, ...updates, points, handles, subpaths, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } as ElementProperties };
      }
      return { ...prev, [id]: { ...existing, ...updates } as ElementProperties };
    });
  }, [setElementProperties]);

  // ── Selection handlers ───────────────────────────────────────────────────
  const handleSelectLayer = useCallback((id: string | null) => {
    if (id) selectLayer(id, false);
    else clearSelection();
  }, [selectLayer, clearSelection]);

  const handleShiftSelectLayer = useCallback((id: string) => { selectLayer(id, true); }, [selectLayer]);
  const handleClearSelection = useCallback(() => { clearSelection(); }, [clearSelection]);

  // ── SVG file import via drag-and-drop ──────────────────────────────────
  const { isDragOver, handleDragOver, handleDragEnter, handleDragLeave, handleDrop } =
    useSvgImport({ saveToHistory, setLayers, setElementProperties, setSelectedLayerIds, setSelectedLayerId });

  // ── Rubber-band multi-select ─────────────────────────────────────────────
  const handleRubberBandSelect = useCallback((ids: string[], addToExisting: boolean) => {
    if (addToExisting) {
      setSelectedLayerIds((prev) => {
        const next = [...new Set([...prev, ...ids])];
        queueMicrotask(() => {
          setSelectedLayerId(next[0] ?? null);
          setLayers((prevLayers) => prevLayers.map((l) => ({ ...l, active: next.includes(l.id) })));
        });
        return next;
      });
    } else {
      setSelectedLayerIds(ids);
      setSelectedLayerId(ids[0] ?? null);
      setLayers((prevLayers) => prevLayers.map((l) => ({ ...l, active: ids.includes(l.id) })));
    }
  }, [setSelectedLayerIds, setSelectedLayerId, setLayers]);

  // ── Fit viewport ─────────────────────────────────────────────────────────
  const fitViewport = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const padding = 96;
    const availableWidth = Math.max(workspace.clientWidth - padding, 1);
    const availableHeight = Math.max(workspace.clientHeight - padding, 1);
    const zoom = clampZoom(Math.min(availableWidth / frameSize.width, availableHeight / frameSize.height));
    setViewport({ zoom, panX: (workspace.clientWidth - frameSize.width * zoom) / 2, panY: (workspace.clientHeight - frameSize.height * zoom) / 2 });
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

  // ── Workspace hand-tool panning ────────────────────────────────────────
  const handleWorkspaceMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only intercept for hand tool; let other events propagate to Canvas.
      if (activeTool !== "hand") return;
      // Don't intercept if the event target is inside the SVG/Canvas.
      const svg = workspaceRef.current?.querySelector("svg");
      if (svg && e.target instanceof Node && svg.contains(e.target)) return;
      e.preventDefault();
      const pan = startPan(e, viewport);
      workspacePanStateRef.current = pan.panState;
      setWorkspacePanning(true);
    },
    [activeTool, viewport],
  );

  const handleWorkspaceMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pan = workspacePanStateRef.current;
      if (!pan) return;
      e.preventDefault();
      setViewport(updatePan(pan, e.clientX, e.clientY, viewport));
    },
    [viewport, setViewport],
  );

  const handleWorkspaceMouseUp = useCallback(() => {
    if (!workspacePanStateRef.current) return;
    workspacePanStateRef.current = null;
    setWorkspacePanning(false);
  }, []);

  // Window mouseup to end workspace panning if drag leaves the workspace
  useEffect(() => {
    if (!workspacePanning) return;
    const handler = () => handleWorkspaceMouseUp();
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [workspacePanning, handleWorkspaceMouseUp]);

  // ── Unsaved-changes guard ────────────────────────────────────────────────
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  useEffect(() => {
    if (!isProjectActive) return;
    const handler = (e: BeforeUnloadEvent) => { if (isDirtyRef.current) e.preventDefault(); };
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
              <h2 className="text-xl font-semibold text-white font-[Poppins]">Create a new banner</h2>
              <p className="text-xs text-zinc-400 mt-1">Get started by creating a blank canvas or picking a standard template.</p>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Custom Dimensions</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-zinc-950 border border-white/5 rounded-md px-3 py-2">
                  <span className="text-zinc-500 text-xs font-mono">W</span>
                  <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="bg-transparent text-sm w-full outline-none text-zinc-300 focus:text-white" />
                </div>
                <div className="flex items-center gap-2 bg-zinc-950 border border-white/5 rounded-md px-3 py-2">
                  <span className="text-zinc-500 text-xs font-mono">H</span>
                  <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="bg-transparent text-sm w-full outline-none text-zinc-300 focus:text-white" />
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
              >Create Blank Canvas</button>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Templates</span>
              <div className="flex flex-col gap-2">
                {[
                  { name: "Standard Banner", desc: "Recommended for profiles", w: 800, h: 200 },
                  { name: "Wide Profile Banner", desc: "Fits wide layouts", w: 1000, h: 220 },
                  { name: "Compact Banner", desc: "Perfect for tight spaces", w: 640, h: 160 },
                ].map((t) => (
                  <button
                    key={t.name}
                    onClick={() => { setFrameSize({ width: t.w, height: t.h }); setIsProjectActive(true); }}
                    className="flex justify-between items-center bg-zinc-950 hover:bg-zinc-800/80 p-3 rounded-md border border-white/5 transition-all text-left group cursor-pointer"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{t.name}</h4>
                      <p className="text-[11px] text-zinc-500">{t.desc}</p>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded">{t.w} × {t.h}</span>
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
      <div
        ref={workspaceRef}
        data-testid="workspace-area"
        className="relative w-full h-full flex items-start justify-start overflow-hidden"
        style={{
          cursor:
            activeTool === "hand"
              ? workspacePanning
                ? "grabbing"
                : "grab"
              : undefined,
        }}
        onMouseDown={handleWorkspaceMouseDown}
        onMouseMove={handleWorkspaceMouseMove}
        onMouseUp={handleWorkspaceMouseUp}
        onMouseLeave={handleWorkspaceMouseUp}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-2xl flex items-center justify-center pointer-events-none">
            <div className="bg-zinc-900/90 border border-blue-500/30 rounded-xl px-6 py-4 shadow-2xl">
              <p className="text-sm font-medium text-blue-400">Drop SVG file to import</p>
            </div>
          </div>
        )}
        <div className="relative group">
          <Canvas
            frameSize={frameSize} activeTool={activeTool} selectedShapeKind={selectedShapeKind} layers={layers}
            selectedLayerId={selectedLayerId} selectedLayerIds={selectedLayerIds}
            isEditingText={isEditingText} elementProperties={elementProperties}
            onCreateText={handleCreateText} onCreateShape={handleCreateShape}
            onCreatePath={handleCreatePath} onPaintLayer={handlePaintLayer}
            paintColor={paintColor} onSelectLayer={handleSelectLayer}
            onShiftSelectLayer={handleShiftSelectLayer}
            onClearSelection={handleClearSelection}
            onRubberBandSelect={handleRubberBandSelect}
            onMoveStart={handleMoveStart} onMoveElement={handleMoveElement}
            onResizeStart={handleResizeStart} onResizeElement={handleResizeElement}
            onRotateStart={handleRotateStart} onRotateElement={handleRotateElement}
            onEditingChange={setIsEditingText} onEditText={handleEditText}
            editingContent={editingContent} editingLayerId={editingLayerId}
            onEditingContentChange={setEditingContent}
            onCommitText={handleCommitText}
            viewport={viewport} onViewportChange={setViewport}
            gridEnabled={gridEnabled} snapEnabled={snapEnabled} gridSize={10}
            previewAnimation={previewAnimation} scrubTime={scrubTime}
            selectedVertex={selectedVertex}
          />
        </div>

        <ViewportControls
          zoom={viewport.zoom} gridEnabled={gridEnabled} snapEnabled={snapEnabled}
          onZoomIn={() => setViewport((current) => {
            const ws = workspaceRef.current; const wsW = ws?.clientWidth ?? 0; const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(current.zoom * 1.1);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom; const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
          onZoomOut={() => setViewport((current) => {
            const ws = workspaceRef.current; const wsW = ws?.clientWidth ?? 0; const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(current.zoom * 0.9);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom; const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
          onFit={fitViewport}
          onToggleGrid={() => setGridEnabled((e) => !e)}
          onToggleSnap={() => setSnapEnabled((e) => !e)}
          onZoomTo={(z) => setViewport((current) => {
            const ws = workspaceRef.current; const wsW = ws?.clientWidth ?? 0; const wsH = ws?.clientHeight ?? 0;
            const newZoom = clampZoom(z);
            if (!wsW || !wsH) return { ...current, zoom: newZoom };
            const wx = (wsW / 2 - current.panX) / current.zoom; const wy = (wsH / 2 - current.panY) / current.zoom;
            return { zoom: newZoom, panX: wsW / 2 - wx * newZoom, panY: wsH / 2 - wy * newZoom };
          })}
        />
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFileChange} />

      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => setShowShortcuts(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-[580px] max-h-[80vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-zinc-100 font-[Poppins]">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="w-7 h-7 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors" aria-label="Close shortcuts">✕</button>
            </div>
            <ShortcutGrid />
          </div>
        </div>
      )}
    </EditorLayout>
  );
}
