import { useEffect, useCallback, useRef, useState } from "react";
import EditorLayout from "../../layouts/EditorLayout";
import { useEditor, clearEditorStorage } from "../../context/EditorContext";
import type { EditorTool, LayerType } from "../../context/EditorContext";
import Canvas from "../../components/editor-canvas/Canvas";
import type { TextElementProperties, ShapeElementProperties, ElementProperties, ShapeKind } from "../../components/editor-canvas/ElementsRenderer";
import { createLayer } from "../../lib/api";
import {
  buildSvgString,
  downloadSvg,
  copySvgText,
  copyMarkdown,
} from "../../lib/export";

// ── localStorage key for element properties ─────────────────────────────────
const EP_STORAGE_KEY = "svg-readme-editor:elementProperties";

// ── Types for clipboard and undo history ───────────────────────────────────

interface ClipboardState {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
}

interface HistoryAction {
  type: "CREATE" | "DELETE" | "MOVE" | "UPDATE" | "PASTE" | "RESIZE" | "ROTATE";
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  selectedLayerIds: string[];
}

interface HistoryState {
  past: HistoryAction[];
  future: HistoryAction[]; // For redo support
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
    frameSize,
    setFrameSize,
    isProjectActive,
    setIsProjectActive,
  } = useEditor();

  const [customWidth, setCustomWidth] = useState("800");
  const [customHeight, setCustomHeight] = useState("200");

  // Track element properties (position, styling for each layer — text or shape)
  const [elementProperties, setElementProperties] = useState<
    Record<string, ElementProperties>
  >(() => {
    try {
      const raw = localStorage.getItem(EP_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, ElementProperties>) : {};
    } catch {
      return {};
    }
  });

  // Persist elementProperties to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(EP_STORAGE_KEY, JSON.stringify(elementProperties));
    } catch { /* ignore */ }
  }, [elementProperties]);

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

  // ── New Project — reset all state and clear localStorage ─────────────────
  const handleNewProject = useCallback(() => {
    clearEditorStorage();
    localStorage.removeItem(EP_STORAGE_KEY);
    setLayers([]);
    setElementProperties({});
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
    setIsProjectActive(false);
    setHistory({ past: [], future: [] });
  }, [setLayers, setSelectedLayerId, setSelectedLayerIds, setIsProjectActive]);

  // Ref to track if we're editing text for keyboard shortcut guard
  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditingText;
  }, [isEditingText]);

  // Ref for export data to avoid re-registering event listeners on every render
  const exportDataRef = useRef({ frameSize, elementProperties, layers });
  useEffect(() => {
    exportDataRef.current = { frameSize, elementProperties, layers };
  }, [frameSize, elementProperties, layers]);

  // ── Save current state to history ──────────────────────────────────────
  const saveToHistory = useCallback(
    (actionType: HistoryAction["type"]) => {
      // Save current state to history before making changes
      setHistory((prevHistory) => {
        const newAction: HistoryAction = {
          type: actionType,
          layers: [...layers],
          elementProperties: { ...elementProperties },
          selectedLayerIds: [...selectedLayerIds],
        };

        return {
          past: [...prevHistory.past, newAction],
          future: [], // Clear future when new action is performed
        };
      });
    },
    [layers, elementProperties, selectedLayerIds],
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
    saveToHistory("DELETE");

    // Delete selected layers
    setLayers((prev) => prev.filter((l) => !selectedLayerIds.includes(l.id)));

    // Clean up element properties for deleted layers
    setElementProperties((prev) => {
      const next = { ...prev };
      selectedLayerIds.forEach((id) => delete next[id]);
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
  const handleCopy = useCallback(() => {
    // Don't copy if no layers are selected
    if (selectedLayerIds.length === 0) return;

    // Copy selected layers and their properties
    const copiedLayers = layers.filter((layer) =>
      selectedLayerIds.includes(layer.id),
    );
    const copiedElementProperties: Record<string, TextElementProperties> = {};
    selectedLayerIds.forEach((id) => {
      if (elementProperties[id]) {
        copiedElementProperties[id] = { ...elementProperties[id] };
      }
    });

    setClipboard({
      layers: copiedLayers,
      elementProperties: copiedElementProperties,
    });
  }, [selectedLayerIds, layers, elementProperties]);

  // ── Paste from clipboard ───────────────────────────────────────────────────
  const PASTE_OFFSET = 20; // Offset to avoid pasting on top of original

  const handlePaste = useCallback(() => {
    // Don't paste if clipboard is empty
    if (!clipboard || clipboard.layers.length === 0) return;

    const newLayers: LayerType[] = [];
    const newElementProperties: Record<string, TextElementProperties> = {};
    const newSelectedLayerIds: string[] = [];

    // Create new IDs and offset positions for each pasted layer
    clipboard.layers.forEach((copiedLayer) => {
      const newId = `${copiedLayer.id}-copy-${Date.now()}`;
      newLayers.push({
        ...copiedLayer,
        id: newId,
        active: true,
      });

      if (clipboard.elementProperties[copiedLayer.id]) {
        const originalProps = clipboard.elementProperties[copiedLayer.id];
        newElementProperties[newId] = {
          ...originalProps,
          // Offset position
          x: (originalProps.x as number) + PASTE_OFFSET,
          y: (originalProps.y as number) + PASTE_OFFSET,
        };
      }

      newSelectedLayerIds.push(newId);
    });

    // Save current state to history before pasting
    saveToHistory("PASTE");

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
  }, [
    clipboard,
    saveToHistory,
    setLayers,
    setElementProperties,
    setSelectedLayerIds,
    setSelectedLayerId,
  ]);

  // ── Undo last action ─────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    // Don't undo if history is empty
    if (history.past.length === 0) return;

    // Get the most recent action to undo
    const actionToUndo = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    const newFuture = [...history.future, actionToUndo];

    // Restore state from the action
    setLayers(actionToUndo.layers);
    setElementProperties(actionToUndo.elementProperties);
    setSelectedLayerIds(actionToUndo.selectedLayerIds);
    setSelectedLayerId(actionToUndo.selectedLayerIds[0] ?? null);

    // Update history
    setHistory({
      past: newPast,
      future: newFuture,
    });
  }, [
    history,
    setLayers,
    setElementProperties,
    setSelectedLayerIds,
    setSelectedLayerId,
    setHistory,
  ]);

  // ── Commit text edits (called on blur or Escape) ────────────────────────
  // Figma behavior: both blur and Escape commit the text, nothing "cancels" edits.
  const handleCommitText = useCallback(() => {
    if (!editingLayerId) return;

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
      setElementProperties((prev) => ({
        ...prev,
        [editingLayerId]: {
          ...prev[editingLayerId],
          content: trimmed,
        },
      }));
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
    setIsEditingText,
    setSelectedLayerId,
    setActiveTool,
  ]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when editing text (V/T would be typed as characters)
      if (isEditingRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCommitText();
        }
        return;
      }

      // Check for Ctrl/Cmd + key combinations
      const isCtrlPressed = e.ctrlKey || e.metaKey;

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
        case "z":
        case "Z":
          if (isCtrlPressed) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case "Escape":
          if (selectedLayerId) {
            setSelectedLayerId(null);
          }
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          handleDeleteSelectedLayers();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedLayerId,
    handleCopy,
    handlePaste,
    handleUndo,
    handleDeleteSelectedLayers,
    handleCommitText,
    setActiveTool,
    setSelectedLayerId,
  ]);

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

      // Create element properties
      const newProps: TextElementProperties = {
        type: "text",
        x,
        y,
        width,
        height,
        content: "",
        fontFamily: "Poppins",
        fontSize: 16,
        fontWeight: 400,
        color: "#ffffff",
        textAlign: "left",
      };

      // Deselect all, add layer, set props, enter edit mode
      selectLayer(tempId, false);
      setLayers((prev) =>
        prev.map((l) => ({ ...l, active: false })).concat(newLayer),
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
      setSelectedLayerId,
      setLayers,
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
        opacity: 1,
      };

      saveToHistory("CREATE");
      selectLayer(tempId, false);
      setLayers((prev) =>
        prev.map((l) => ({ ...l, active: false })).concat(newLayer),
      );
      setElementProperties((prev) => ({ ...prev, [tempId]: newProps }));

      // Switch back to move tool after placing shape (matches Figma UX)
      setActiveTool("move");

      // Persist to backend (fire-and-forget)
      createLayer(TEMP_PROJECT_ID, { name: newLayer.name }).catch(
        console.error,
      );
    },
    [saveToHistory, selectLayer, setLayers, setActiveTool],
  );

  // ── Move element ──────────────────────────────────────────────────────────
  const handleMoveElement = useCallback((id: string, x: number, y: number) => {
    setElementProperties((prev) => ({
      ...prev,
      [id]: prev[id] ? { ...prev[id], x, y } : prev[id],
    }));
  }, []);

  // ── Resize element ────────────────────────────────────────────────────────
  const handleResizeElement = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setElementProperties((prev) => {
        const props = prev[id];
        if (!props) return prev;
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
    [],
  );

  // ── Resize start (saves state to history) ──────────────────────────────────
  const handleResizeStart = useCallback(() => {
    saveToHistory("RESIZE");
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
    [],
  );

  // ── Rotate start (saves state to history) ──────────────────────────────────
  const handleRotateStart = useCallback(() => {
    saveToHistory("ROTATE");
  }, [saveToHistory]);

  // ── Tool change handler (commits text if editing, then switches) ──────────
  const handleToolChange = useCallback(
    (tool: EditorTool) => {
      if (isEditingText) {
        handleCommitText();
      }
      setActiveTool(tool);
    },
    [isEditingText, handleCommitText, setActiveTool],
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

  // ── Export handler: build SVG and trigger download ──────────────────────
  const handleExport = useCallback(() => {
    const svgString = buildSvgString({
      frameSize,
      elementProperties,
      layers,
    });
    downloadSvg(svgString, "banner.svg");
  }, [frameSize, elementProperties, layers]);

  // ── Listen for custom copy events from EditorRightBar ───────────────────
  useEffect(() => {
    const handleCopySvg = () => {
      const data = exportDataRef.current;
      const svgString = buildSvgString(data);
      copySvgText(svgString).catch(console.error);
    };

    const handleCopyMd = () => {
      copyMarkdown("banner.svg").catch(console.error);
    };

    window.addEventListener("copy-svg-code", handleCopySvg);
    window.addEventListener("copy-markdown", handleCopyMd);
    return () => {
      window.removeEventListener("copy-svg-code", handleCopySvg);
      window.removeEventListener("copy-markdown", handleCopyMd);
    };
  }, []);

  // ── Rubber-band multi-select (drag on empty canvas) ──────────────────────
  const handleRubberBandSelect = useCallback(
    (ids: string[], addToExisting: boolean) => {
      if (addToExisting) {
        // Shift+drag: add rubber-band elements to existing selection.
        // Use functional updaters for both states to avoid closure staleness.
        setSelectedLayerIds((prev) => {
          const next = [...new Set([...prev, ...ids])];
          setSelectedLayerId(next[0] ?? null);
          // Sync layer active flags within the same batch
          setLayers((prevLayers) =>
            prevLayers.map((l) => ({ ...l, active: next.includes(l.id) })),
          );
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

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isProjectActive) {
    return (
      <EditorLayout
        frameSize={frameSize}
        setFrameSize={setFrameSize}
        onToolSelect={handleToolChange}
        onExport={handleExport}
        onNewProject={handleNewProject}
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
    >
      {/* Canvas Area wrapper for zoom/pan context */}
      <div className="relative w-full h-full flex items-center justify-center p-12 overflow-hidden">
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
            onSelectLayer={handleSelectLayer}
            onShiftSelectLayer={handleShiftSelectLayer}
            onClearSelection={handleClearSelection}
            onRubberBandSelect={handleRubberBandSelect}
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
          />
        </div>

        {/* Canvas Controls (Zoom, Pan) */}
        <div className="absolute bottom-6 right-6 flex items-center bg-[#09090b]/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl z-20">
          <button className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <div className="px-3 text-xs font-mono text-zinc-300 select-none">
            100%
          </div>
          <button className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </div>
    </EditorLayout>
  );
}
