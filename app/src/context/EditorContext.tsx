import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = "svg-readme-editor";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${key}`);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${LS_KEY}:${key}`, JSON.stringify(value));
  } catch {
    /* quota exceeded – silently ignore */
  }
}

export function clearEditorStorage(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(`${LS_KEY}:`),
    );
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayerType = {
  id: string;
  name: string;
  type: string;
  locked: boolean;
  visible: boolean;
  active?: boolean;
};

export type EditorTool =
  | "move"
  | "text"
  | "frame"
  | "pen"
  | "rect"
  | "circle"
  | "triangle"
  | "star"
  | "hexagon"
  | "line"
  | "image";

export interface EditorState {
  activeTool: EditorTool;
  isEditingText: boolean;
  /** @deprecated Use selectedLayerIds instead for multi-select support */
  selectedLayerId: string | null;
  /** Multi-selection support — array of selected layer IDs.
   *  When Shift+clicking, layers are toggled in this array.
   *  When clicking without Shift, this array is replaced with just the clicked layer. */
  selectedLayerIds: string[];
  layers: LayerType[];
  frameSize: { width: number; height: number };
  isProjectActive: boolean;
}

export interface EditorActions {
  setActiveTool: (tool: EditorTool) => void;
  setIsEditingText: (editing: boolean) => void;
  /** @deprecated Use selectLayer(id, isShift) or clearSelection() instead */
  setSelectedLayerId: (id: string | null) => void;
  /** Direct setter for selectedLayerIds — used for bulk selection like rubber-band.
   *  Prefer selectLayer() or clearSelection() for standard interactions. */
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** Multi-select aware selection: when isShift is true, toggles the layer
   *  in/out of selection. When isShift is false, replaces selection with
   *  just this layer. Matches Figma's Shift+click behavior. */
  selectLayer: (id: string, isShift: boolean) => void;
  /** Clears all selected layers. Matches Figma's click-on-empty-canvas. */
  clearSelection: () => void;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  setFrameSize: (size: { width: number; height: number }) => void;
  setIsProjectActive: (active: boolean) => void;
}

export type EditorContextValue = EditorState & EditorActions;

// ─── Context ──────────────────────────────────────────────────────────────────

const EditorContext = createContext<EditorContextValue | null>(null);

// ─── Provider Props ──────────────────────────────────────────────────────────

interface EditorProviderProps {
  children: ReactNode;
  initial?: Partial<EditorState>;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EditorProvider({ children, initial }: EditorProviderProps) {
  const [activeTool, setActiveTool] = useState<EditorTool>(
    initial?.activeTool ?? "move",
  );
  const [isEditingText, setIsEditingText] = useState(
    initial?.isEditingText ?? false,
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    initial?.selectedLayerId ?? null,
  );
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(
    initial?.selectedLayerIds ?? [],
  );
  const [layers, setLayers] = useState<LayerType[]>(
    initial?.layers ?? readStorage<LayerType[]>("layers", []),
  );
  const [frameSize, setFrameSize] = useState(
    initial?.frameSize ??
      readStorage("frameSize", { width: 700, height: 350 }),
  );
  const [isProjectActive, setIsProjectActive] = useState(
    initial?.isProjectActive ?? readStorage<boolean>("isProjectActive", false),
  );

  // ── Persist to localStorage whenever these values change ──────────────────
  useEffect(() => { writeStorage("layers", layers); }, [layers]);
  useEffect(() => { writeStorage("frameSize", frameSize); }, [frameSize]);
  useEffect(() => { writeStorage("isProjectActive", isProjectActive); }, [isProjectActive]);

  // Multi-select action: Figma Shift+click behavior
  const selectLayer = useCallback(
    (id: string, isShift: boolean) => {
      if (isShift) {
        // Shift+click: toggle this layer in/out of the selection
        setSelectedLayerIds((prev) => {
          const next = prev.includes(id)
            ? prev.filter((lid) => lid !== id)
            : [...prev, id];
          // Keep selectedLayerId in sync: point to first selected or null
          setSelectedLayerId(next.length > 0 ? next[0] : null);
          // Sync layer active flags so the LayerPanel shows all selected layers
          setLayers((prevLayers) =>
            prevLayers.map((l) => ({ ...l, active: next.includes(l.id) })),
          );
          return next;
        });
      } else {
        // Normal click: replace selection with just this layer
        setSelectedLayerIds([id]);
        setSelectedLayerId(id);
        // Only this layer is active in the sidebar
        setLayers((prevLayers) =>
          prevLayers.map((l) => ({ ...l, active: l.id === id })),
        );
      }
    },
    [setLayers],
  );

  // Clear all selection: Figma click-on-empty-canvas
  const clearSelection = useCallback(() => {
    setSelectedLayerIds([]);
    setSelectedLayerId(null);
    // Deactivate all layers in the sidebar
    setLayers((prev) => prev.map((l) => ({ ...l, active: false })));
  }, [setLayers]);

  const value: EditorContextValue = {
    // State
    activeTool,
    isEditingText,
    selectedLayerId,
    selectedLayerIds,
    layers,
    frameSize,
    isProjectActive,
    // Actions
    setActiveTool,
    setIsEditingText,
    setSelectedLayerId,
    setSelectedLayerIds,
    selectLayer,
    clearSelection,
    setLayers,
    setFrameSize,
    setIsProjectActive,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return ctx;
}
