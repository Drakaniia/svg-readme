import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
  type: "text" | "shape" | "image" | "group";
  locked: boolean;
  visible: boolean;
  active?: boolean;
  /** parentId links this layer to a group. null = root level, string = child of group with that id */
  parentId?: string | null;
  /** Only for groups: whether the group is collapsed in the layer panel */
  collapsed?: boolean;
  /** Whether this layer acts as a mask for its group children */
  masked?: boolean;
};

export type EditorTool =
  | "move"
  | "hand"
  | "text"
  | "frame"
  | "pen"
  | "rect"
  | "circle"
  | "triangle"
  | "star"
  | "hexagon"
  | "line"
  | "image"
  | "paint";

// Import inline to avoid circular dependency
type ElementProperties = import("../components/editor-canvas/ElementsRenderer").ElementProperties;

export interface EditorState {
  activeTool: EditorTool;
  /** Color selected for the paint bucket tool (hex like "#ff0000"). */
  paintColor: string;
  isEditingText: boolean;
  /** @deprecated Use selectedLayerIds instead for multi-select support */
  selectedLayerId: string | null;
  /** Multi-selection support — array of selected layer IDs. */
  selectedLayerIds: string[];
  layers: LayerType[];
  /** Element properties map (layerId → properties) — unified localStorage. */
  elementProperties: Record<string, ElementProperties>;
  frameSize: { width: number; height: number };
  isProjectActive: boolean;
  /** When true, the canvas previews CSS animations on elements that have an animation config. */
  previewAnimation: boolean;
  /** When > 0, the canvas is in scrub mode and animations are paused at this time position. */
  scrubTime: number | null;
  /** Whether the document has unsaved changes (dirty state for navbar indicator). */
  isDirty: boolean;
  /** The backend project ID, if this project has been saved/loaded from backend. */
  currentProjectId: string | null;
  /** Editable project name shown in the navbar. */
  projectName: string;
}

export interface EditorActions {
  setActiveTool: (tool: EditorTool) => void;
  /** Set the paint bucket color. */
  setPaintColor: (color: string) => void;
  setIsEditingText: (editing: boolean) => void;
  /** @deprecated Use selectLayer(id, isShift) or clearSelection() instead */
  setSelectedLayerId: (id: string | null) => void;
  /** Direct setter for selectedLayerIds. */
  setSelectedLayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** Multi-select aware selection: when isShift is true, toggles the layer in/out. */
  selectLayer: (id: string, isShift: boolean) => void;
  /** Clears all selected layers. */
  clearSelection: () => void;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  /** Element properties setter (persists to localStorage). */
  setElementProperties: React.Dispatch<React.SetStateAction<Record<string, ElementProperties>>>;
  setFrameSize: (size: { width: number; height: number }) => void;
  setIsProjectActive: (active: boolean) => void;
  setPreviewAnimation: (preview: boolean) => void;
  setScrubTime: (time: number | null) => void;
  /** Mark the document as clean (called after a successful save). */
  markClean: () => void;
  /** Set the backend project ID. */
  setCurrentProjectId: (id: string | null) => void;
  /** Set the project name. */
  setProjectName: (name: string) => void;
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
  const [paintColor, setPaintColor] = useState<string>(
    readStorage("paintColor", "#3b82f6"),
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
  const [elementProperties, setElementProperties] = useState<
    Record<string, ElementProperties>
  >(
    initial?.elementProperties ??
    readStorage<Record<string, ElementProperties>>("elementProperties", {}),
  );
  const [frameSize, setFrameSize] = useState(
    initial?.frameSize ??
      readStorage("frameSize", { width: 700, height: 350 }),
  );
  const [isProjectActive, setIsProjectActive] = useState(
    initial?.isProjectActive ?? readStorage<boolean>("isProjectActive", false),
  );
  const [previewAnimation, setPreviewAnimation] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    readStorage<string | null>("currentProjectId", null),
  );
  const [projectName, setProjectName] = useState(
    readStorage<string>("projectName", "Untitled"),
  );

  // ── Persist to localStorage whenever these values change ──────────────────
  useEffect(() => { writeStorage("layers", layers); }, [layers]);
  useEffect(() => { writeStorage("elementProperties", elementProperties); }, [elementProperties]);
  useEffect(() => { writeStorage("frameSize", frameSize); }, [frameSize]);
  useEffect(() => { writeStorage("isProjectActive", isProjectActive); }, [isProjectActive]);
  useEffect(() => { writeStorage("currentProjectId", currentProjectId); }, [currentProjectId]);
  useEffect(() => { writeStorage("projectName", projectName); }, [projectName]);
  useEffect(() => { writeStorage("paintColor", paintColor); }, [paintColor]);

  // Mark dirty whenever state that affects the document changes.
  // isProjectActive is excluded from the dep array intentionally: merely
  // activating a project (opening a blank canvas) should not flag dirty.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    // Intentionally marks dirty in an effect: document mutations can come from
    // many places, and we must exclude isProjectActive from the deps so simply
    // opening a project doesn't flag the document as dirty.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isProjectActive) setIsDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, elementProperties, frameSize]);

  // Multi-select action: Figma Shift+click behavior
  const selectLayer = useCallback(
    (id: string, isShift: boolean) => {
      if (isShift) {
        setSelectedLayerIds((prev) => {
          const next = prev.includes(id)
            ? prev.filter((lid) => lid !== id)
            : [...prev, id];
          // Batch dependent state updates via microtask to avoid nesting setState calls
          queueMicrotask(() => {
            setSelectedLayerId(next.length > 0 ? next[0] : null);
            setLayers((prevLayers) =>
              prevLayers.map((l) => ({ ...l, active: next.includes(l.id) })),
            );
          });
          return next;
        });
      } else {
        setSelectedLayerIds([id]);
        setSelectedLayerId(id);
        setLayers((prevLayers) =>
          prevLayers.map((l) => ({ ...l, active: l.id === id })),
        );
      }
    },
    [setLayers],
  );

  // Clear all selection
  const clearSelection = useCallback(() => {
    setSelectedLayerIds([]);
    setSelectedLayerId(null);
    setLayers((prev) => prev.map((l) => ({ ...l, active: false })));
  }, [setLayers]);

  const value: EditorContextValue = {
    activeTool,
    paintColor,
    isEditingText,
    selectedLayerId,
    selectedLayerIds,
    layers,
    elementProperties,
    frameSize,
    isProjectActive,
    setActiveTool,
    setPaintColor,
    setIsEditingText,
    setSelectedLayerId,
    setSelectedLayerIds,
    selectLayer,
    clearSelection,
    setLayers,
    setElementProperties,
    setFrameSize,
    setIsProjectActive,
    previewAnimation,
    setPreviewAnimation,
    scrubTime,
    setScrubTime,
    isDirty,
    markClean: () => setIsDirty(false),
    currentProjectId,
    setCurrentProjectId,
    projectName,
    setProjectName,
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
