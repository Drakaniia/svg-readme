import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

export interface FlattenResult {
  updatedLayers: LayerType[];
  updatedProperties: Record<string, ElementProperties>;
  removedIds: string[];
}

/**
 * Flatten a group layer: remove the group wrapper and promote children to the
 * group's parent level, keeping all child properties intact.
 */
export function flattenGroup(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  groupId: string,
): FlattenResult | null {
  const groupLayer = layers.find((l) => l.id === groupId);
  if (!groupLayer || groupLayer.type !== "group") return null;

  const parentId = groupLayer.parentId ?? null;
  const removedIds: string[] = [groupId];
  const updatedProperties = { ...elementProperties };
  delete updatedProperties[groupId];

  // Remove group, reparent children
  const updatedLayers = layers.flatMap((layer) => {
    if (layer.id === groupId) return [];
    if ((layer.parentId ?? null) === groupId) {
      return [{ ...layer, parentId }];
    }
    return [layer];
  });

  return { updatedLayers, updatedProperties, removedIds };
}
