import {
  createProject,
  updateProject,
  bulkSaveLayers,
  saveElements,
  listProjects,
  getProject,
  deleteProject,
  getLayers,
  getElements,
  type ApiProject,
} from "./api";
import type { LayerType } from "../context/EditorContext";
import type { ElementProperties } from "../components/editor-canvas/ElementsRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentState {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  frameSize: { width: number; height: number };
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

// ─── In-memory state ─────────────────────────────────────────────────────────

let currentProjectId: string | null = null;
let lastSavedSnapshot: string | null = null; // JSON.stringify'd DocumentState
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;
const AUTOSAVE_DELAY_MS = 1500;

// Callbacks that UI can subscribe to
type StatusListener = (status: SaveStatus) => void;
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

let listeners: StatusListener[] = [];
let currentStatus: SaveStatus = { kind: "idle" };

function notifyListeners(status: SaveStatus) {
  currentStatus = status;
  listeners.forEach((fn) => fn(status));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Subscribe to save status changes. Returns unsubscribe function. */
export function onSaveStatus(fn: StatusListener): () => void {
  listeners.push(fn);
  // Immediately notify with current status
  fn(currentStatus);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Get current save status */
export function getSaveStatus(): SaveStatus {
  return currentStatus;
}

/** Get current project ID */
export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

/**
 * Create a new project on the backend and set it as current.
 * Returns the project ID.
 */
export async function saveNewProject(
  name: string,
  doc: DocumentState,
): Promise<string> {
  notifyListeners({ kind: "saving" });

  const project = await createProject({
    name,
    canvasWidth: doc.frameSize.width,
    canvasHeight: doc.frameSize.height,
  });

  currentProjectId = project.id;

  // Save layers + elements
  await persistDocument(doc);

  lastSavedSnapshot = JSON.stringify(doc);
  notifyListeners({ kind: "saved", at: new Date() });
  return project.id;
}

/**
 * Save the current document to the backend (immediate, not debounced).
 * Creates the project if it doesn't exist yet.
 */
export async function saveDocument(
  doc: DocumentState,
  projectName?: string,
): Promise<SaveResult> {
  if (!currentProjectId) {
    return { success: false, error: "No active project" };
  }

  if (isSaving) return { success: false, error: "Save already in progress" };
  isSaving = true;

  try {
    notifyListeners({ kind: "saving" });
    await persistDocument(doc);
    // Update project metadata
    const updateData: { canvasWidth: number; canvasHeight: number; name?: string } = {
      canvasWidth: doc.frameSize.width,
      canvasHeight: doc.frameSize.height,
    };
    if (projectName !== undefined) updateData.name = projectName;
    await updateProject(currentProjectId, updateData);
    lastSavedSnapshot = JSON.stringify(doc);
    notifyListeners({ kind: "saved", at: new Date() });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save";
    notifyListeners({ kind: "error", message });
    return { success: false, error: message };
  } finally {
    isSaving = false;
  }
}

/**
 * Trigger a debounced autosave. Call this whenever the document changes.
 */
export function autosave(doc: DocumentState): void {
  if (!currentProjectId) return;

  // Skip if nothing changed since last save
  const current = JSON.stringify(doc);
  if (current === lastSavedSnapshot) return;

  // Clear existing timer
  if (saveTimer) clearTimeout(saveTimer);

  // Set new timer
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    await saveDocument(doc);
  }, AUTOSAVE_DELAY_MS);
}

/**
 * Flush any pending autosave immediately.
 */
export async function flushAutosave(doc: DocumentState): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!currentProjectId) return;
  const current = JSON.stringify(doc);
  if (current !== lastSavedSnapshot) {
    await saveDocument(doc);
  }
}

/**
 * Load a project's full state from the backend.
 */
export async function loadProject(
  projectId: string,
): Promise<{ project: ApiProject; doc: DocumentState } | null> {
  try {
    const [project, layers, elements] = await Promise.all([
      getProject(projectId),
      getLayers(projectId),
      getElements(projectId),
    ]);

    currentProjectId = projectId;

    // Map layers
    const mappedLayers: LayerType[] = layers.map((l) => ({
      id: l.id,
      name: l.name,
      type: mapBackendType(l.type),
      locked: l.locked,
      visible: l.visible,
      active: false,
      parentId: l.parentId ?? null,
    }));

    // Map elements to elementProperties
    const mappedProps: Record<string, ElementProperties> = {};
    elements.forEach((el) => {
      if (el.properties && typeof el.properties === "object") {
        mappedProps[el.layerId] = el.properties as unknown as ElementProperties;
      }
    });

    const doc: DocumentState = {
      layers: mappedLayers,
      elementProperties: mappedProps,
      frameSize: {
        width: project.canvasWidth,
        height: project.canvasHeight,
      },
    };

    lastSavedSnapshot = JSON.stringify(doc);
    notifyListeners({ kind: "saved", at: new Date() });

    return { project, doc };
  } catch (error) {
    console.error("Failed to load project:", error);
    return null;
  }
}

/** List all projects from the backend */
export async function fetchProjectList(): Promise<ApiProject[]> {
  return listProjects();
}

/** Delete a project by ID */
export async function removeProject(id: string): Promise<void> {
  await deleteProject(id);
  if (currentProjectId === id) {
    currentProjectId = null;
    lastSavedSnapshot = null;
  }
}

/** Set the current project (e.g., when loading from localStorage without backend) */
export function setCurrentProjectId(id: string | null): void {
  currentProjectId = id;
  if (!id) lastSavedSnapshot = null;
}

/** Whether the document has unsaved changes compared to last backend save */
export function isDocumentDirty(doc: DocumentState): boolean {
  return JSON.stringify(doc) !== lastSavedSnapshot;
}

/** Reset the persistence service (on new project / sign out) */
export function resetPersistence(): void {
  currentProjectId = null;
  lastSavedSnapshot = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  notifyListeners({ kind: "idle" });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function mapBackendType(type: string): LayerType["type"] {
  switch (type) {
    case "text":
    case "shape":
    case "image":
    case "group":
      return type;
    default:
      return "shape";
  }
}

async function persistDocument(doc: DocumentState): Promise<void> {
  const pid = currentProjectId!;

  // Save layers (bulk)
  const layerPayload = doc.layers.map((l, i) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    orderIndex: i,
    locked: l.locked,
    visible: l.visible,
    parentId: l.parentId ?? null,
  }));
  await bulkSaveLayers(pid, layerPayload);

  // Save elements (bulk) — always call to clear orphans
  const elementPayload = Object.entries(doc.elementProperties).map(
    ([layerId, props], i) => ({
      layerId,
      type: (props as ElementProperties).type ?? "shape",
      orderIndex: i,
      properties: props as unknown as Record<string, unknown>,
    }),
  );
  await saveElements(pid, elementPayload);
}
