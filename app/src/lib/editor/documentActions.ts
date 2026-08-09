import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { translatePoints } from "./pathUtils";

export interface DocumentSnapshot {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  selectedLayerIds: string[];
}

export interface DocumentHistory {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}

export interface HistoryTransition {
  history: DocumentHistory;
  snapshot: DocumentSnapshot | null;
}

/** Maximum number of undo snapshots kept in history (older entries are dropped). */
export const HISTORY_LIMIT = 100;

/**
 * Push a snapshot onto the undo stack, capping the stack at HISTORY_LIMIT.
 * No-op pushes are skipped: when the snapshot is identical to the current top
 * of the stack (e.g. focusing an input without changing its value), nothing is
 * added so undo isn't polluted with useless entries.
 *
 * Note: the no-op check serializes the top snapshot (JSON.stringify), which is
 * O(doc size) per push — fine for banner-sized documents; revisit with a cheap
 * fingerprint if documents grow large.
 */
export function pushHistory(
  past: DocumentSnapshot[],
  snapshot: DocumentSnapshot,
): DocumentSnapshot[] {
  const last = past[past.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(snapshot)) {
    return past;
  }
  return [...past, snapshot].slice(-HISTORY_LIMIT);
}

export function cloneDocumentSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  return {
    layers: snapshot.layers.map((layer) => ({ ...layer })),
    elementProperties: Object.fromEntries(
      Object.entries(snapshot.elementProperties).map(([id, properties]) => [id, { ...properties }]),
    ) as Record<string, ElementProperties>,
    selectedLayerIds: [...snapshot.selectedLayerIds],
  };
}

export function undoDocument(
  history: DocumentHistory,
  current: DocumentSnapshot,
): HistoryTransition {
  const previous = history.past.at(-1);
  if (!previous) return { history, snapshot: null };

  return {
    snapshot: cloneDocumentSnapshot(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, cloneDocumentSnapshot(current)],
    },
  };
}

export function redoDocument(
  history: DocumentHistory,
  current: DocumentSnapshot,
): HistoryTransition {
  const next = history.future.at(-1);
  if (!next) return { history, snapshot: null };

  return {
    snapshot: cloneDocumentSnapshot(next),
    history: {
      past: [...history.past, cloneDocumentSnapshot(current)],
      future: history.future.slice(0, -1),
    },
  };
}

export type ReorderDirection = "forward" | "backward" | "front" | "back";

/**
 * Group the selected layers into a new group layer.
 * Only layers at the same parent level can be grouped together.
 * Returns null if grouping is not possible (< 2 layers selected).
 */
export interface GroupResult {
  groupLayer: LayerType;
  updatedLayers: LayerType[];
}

export function groupLayers(
  layers: LayerType[],
  selectedLayerIds: string[],
): GroupResult | null {
  const selected = new Set(selectedLayerIds);
  if (selected.size < 2) return null;

  // Find the first selected layer to determine insertion position and parent
  const firstSelectedIndex = layers.findIndex((l) => selected.has(l.id));
  if (firstSelectedIndex === -1) return null;

  const parentId = layers[firstSelectedIndex].parentId ?? null;

  // All selected layers must share the same parent
  const allSameParent = selectedLayerIds.every((id) => {
    const layer = layers.find((l) => l.id === id);
    return layer && (layer.parentId ?? null) === parentId;
  });
  if (!allSameParent) return null;

  // Create the group layer
  const groupId = `group-${Date.now()}`;
  const groupLayer: LayerType = {
    id: groupId,
    name: "Group",
    type: "group",
    locked: false,
    visible: true,
    parentId,
    collapsed: false,
  };

  // Update selected layers to point to the new group
  const updatedLayers = layers.map((layer) => {
    if (selected.has(layer.id)) {
      return { ...layer, parentId: groupId, active: false };
    }
    return layer;
  });

  // Insert the group layer at the position of the first selected layer
  const result = [...updatedLayers];
  result.splice(firstSelectedIndex, 0, groupLayer);

  return { groupLayer, updatedLayers: result };
}

/**
 * Ungroup a group layer, moving its children to the group's parent level.
 * Returns null if the layer is not a group.
 */
export interface UngroupResult {
  updatedLayers: LayerType[];
  childIds: string[];
}

export function ungroupLayer(
  layers: LayerType[],
  groupId: string,
): UngroupResult | null {
  const groupLayer = layers.find((l) => l.id === groupId);
  if (!groupLayer || groupLayer.type !== "group") return null;

  const groupIndex = layers.findIndex((l) => l.id === groupId);
  if (groupIndex === -1) return null;

  const parentId = groupLayer.parentId ?? null;

  // Find all children and move them to the group's parent
  const childIds: string[] = [];
  const updatedLayers = layers.flatMap((layer) => {
    if (layer.id === groupId) return []; // Remove the group itself
    if ((layer.parentId ?? null) === groupId) {
      childIds.push(layer.id);
      return [{ ...layer, parentId }];
    }
    return [layer];
  });

  return { updatedLayers, childIds };
}

/**
 * Check if selected layers can be grouped (same parent, >= 2 non-group leaf layers).
 */
export function canGroupLayers(layers: LayerType[], selectedLayerIds: string[]): boolean {
  if (selectedLayerIds.length < 2) return false;
  const selectedLayers = layers.filter((l) => selectedLayerIds.includes(l.id));
  const firstParent = selectedLayers[0]?.parentId ?? null;
  return selectedLayers.every((l) => (l.parentId ?? null) === firstParent);
}

export interface DuplicateResult {
  duplicatedLayers: LayerType[];
  duplicatedProperties: Record<string, ElementProperties>;
  duplicatedTopIds: string[];
}

/**
 * Duplicate a set of layers (the selection PLUS all of its descendants) with
 * freshly generated ids. Every copied layer's `parentId` is remapped through
 * the old→new id map, so duplicated children stay nested under their
 * duplicated group instead of pointing back at the original group (the A7
 * nested-layer correctness fix). Path geometry (points/handles/subpaths) is
 * shifted by (offsetX, offsetY) so the copy is visible next to the original.
 *
 * Returns null when nothing can be duplicated.
 */
export function duplicateLayersWithChildren(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  selectedLayerIds: string[],
  offsetX = 20,
  offsetY = 20,
): DuplicateResult | null {
  if (selectedLayerIds.length === 0) return null;

  // Collect ALL layers to duplicate: selection + all descendants
  const toDuplicate = new Set(selectedLayerIds);
  const collectDescendants = (parentId: string) => {
    layers.forEach((l) => {
      if ((l.parentId ?? null) === parentId) {
        toDuplicate.add(l.id);
        collectDescendants(l.id);
      }
    });
  };
  [...selectedLayerIds].forEach((id) => collectDescendants(id));

  // Build old→new id map, then duplicate layers with remapped parentId
  const stamp = Date.now();
  const idMap = new Map<string, string>();
  let idx = 0;
  for (const id of toDuplicate) {
    idMap.set(id, `${id}-duplicate-${stamp}-${idx++}`);
  }

  const duplicatedLayers: LayerType[] = [];
  const duplicatedProperties: Record<string, ElementProperties> = {};
  const duplicatedTopIds: string[] = [];

  for (const originalId of toDuplicate) {
    const layer = layers.find((item) => item.id === originalId);
    if (!layer) continue;
    const newId = idMap.get(originalId)!;

    duplicatedLayers.push({
      ...layer,
      id: newId,
      active: true,
      parentId: layer.parentId
        ? (idMap.get(layer.parentId) ?? layer.parentId)
        : layer.parentId,
    });

    const originalProps = elementProperties[originalId];
    if (originalProps) {
      // Paths store their geometry in absolute points — shift them too.
      if (originalProps.type === "path") {
        const { points, handles, bounds, subpaths } = translatePoints(
          originalProps.points,
          offsetX,
          offsetY,
          originalProps.handles,
          originalProps.subpaths,
        );
        duplicatedProperties[newId] = {
          ...originalProps,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          points,
          handles,
          subpaths,
        };
      } else {
        duplicatedProperties[newId] = {
          ...originalProps,
          x: (originalProps.x as number) + offsetX,
          y: (originalProps.y as number) + offsetY,
        };
      }
    }

    // Track top-level duplicated layers (those in the original selection)
    if (selectedLayerIds.includes(originalId)) {
      duplicatedTopIds.push(newId);
    }
  }

  if (duplicatedLayers.length === 0) return null;
  return { duplicatedLayers, duplicatedProperties, duplicatedTopIds };
}

export function reorderSelectedLayers(
  layers: LayerType[],
  selectedLayerIds: string[],
  direction: ReorderDirection,
): LayerType[] {
  const selected = new Set(selectedLayerIds);
  if (selected.size === 0) return layers;

  if (direction === "front") {
    return [...layers.filter((layer) => !selected.has(layer.id)), ...layers.filter((layer) => selected.has(layer.id))];
  }

  if (direction === "back") {
    return [...layers.filter((layer) => selected.has(layer.id)), ...layers.filter((layer) => !selected.has(layer.id))];
  }

  const result = [...layers];
  const selectedIndices = result
    .map((layer, index) => (selected.has(layer.id) ? index : -1))
    .filter((index) => index >= 0);
  if (selectedIndices.length === 0) return layers;

  if (direction === "forward") {
    for (let index = result.length - 2; index >= 0; index -= 1) {
      if (!selected.has(result[index].id) || selected.has(result[index + 1].id)) continue;
      [result[index], result[index + 1]] = [result[index + 1], result[index]];
    }
    return result;
  }

  for (let index = 1; index < result.length; index += 1) {
    if (!selected.has(result[index].id) || selected.has(result[index - 1].id)) continue;
    [result[index - 1], result[index]] = [result[index], result[index - 1]];
  }
  return result;
}
