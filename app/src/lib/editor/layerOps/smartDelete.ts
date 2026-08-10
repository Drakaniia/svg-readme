import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

/**
 * Smart delete: removes selected layers but preserves group structure.
 * When a group has only one child and that child is deleted, the group is also removed.
 * When alt-delete: removes the layer but preserves its children by promoting them.
 */
export function smartDelete(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  selectedLayerIds: string[],
  preserveChildren = false,
): { updatedLayers: LayerType[]; updatedProperties: Record<string, ElementProperties> } | null {
  const selected = new Set(selectedLayerIds);
  if (selected.size === 0) return null;

  let updatedLayers = [...layers];
  const updatedProperties = { ...elementProperties };

  // If preserving children, reparent children of deleted groups to the group's parent
  if (preserveChildren) {
    const toRemove = new Set<string>();

    for (const id of selected) {
      const layer = updatedLayers.find((l) => l.id === id);
      if (!layer) continue;

      toRemove.add(id);
      delete updatedProperties[id];

      // If this layer is a group, reparent its children
      if (layer.type === "group") {
        const parentId = layer.parentId ?? null;
        updatedLayers = updatedLayers.map((l) => {
          if ((l.parentId ?? null) === id) {
            return { ...l, parentId };
          }
          return l;
        });
      }
    }

    updatedLayers = updatedLayers.filter((l) => !toRemove.has(l.id));
  } else {
    // Standard delete: remove selected layers and their properties
    const toRemove = new Set(selectedLayerIds);

    // Collect all descendant IDs so we remove children of deleted groups too
    const collectDescendants = (parentId: string) => {
      updatedLayers.forEach((l) => {
        if ((l.parentId ?? null) === parentId) {
          toRemove.add(l.id);
          delete updatedProperties[l.id];
          collectDescendants(l.id);
        }
      });
    };
    for (const id of selected) {
      collectDescendants(id);
    }

    // Also clean up empty groups (groups with no remaining children)
    const childCount = new Map<string | null, number>();
    for (const l of updatedLayers) {
      if (toRemove.has(l.id)) continue;
      const parent = l.parentId ?? null;
      childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
    }

    for (const l of updatedLayers) {
      if (l.type === "group" && !toRemove.has(l.id) && (childCount.get(l.id) ?? 0) === 0) {
        toRemove.add(l.id);
        delete updatedProperties[l.id];
      }
    }

    updatedLayers = updatedLayers.filter((l) => !toRemove.has(l.id));
  }

  return { updatedLayers, updatedProperties };
}
