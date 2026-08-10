import type { LayerType } from "../../../context/EditorContext";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";

/**
 * Wrap selected layers in a new frame (group layer with frame semantics).
 */
export function wrapInFrame(
  layers: LayerType[],
  selectedLayerIds: string[],
): { updatedLayers: LayerType[]; groupId: string } | null {
  const selected = new Set(selectedLayerIds);
  if (selected.size === 0) return null;

  const firstSelectedIndex = layers.findIndex((l) => selected.has(l.id));
  if (firstSelectedIndex === -1) return null;

  const parentId = layers[firstSelectedIndex].parentId ?? null;

  // All selected layers must share the same parent
  const allSameParent = selectedLayerIds.every((id) => {
    const layer = layers.find((l) => l.id === id);
    return layer && (layer.parentId ?? null) === parentId;
  });
  if (!allSameParent) return null;

  const groupId = `frame-${Date.now()}`;
  const groupLayer: LayerType = {
    id: groupId,
    name: "Frame",
    type: "group",
    locked: false,
    visible: true,
    parentId,
    collapsed: false,
  };

  const updatedLayers = layers.map((layer) => {
    if (selected.has(layer.id)) {
      return { ...layer, parentId: groupId, active: false };
    }
    return layer;
  });

  const result = [...updatedLayers];
  result.splice(firstSelectedIndex, 0, groupLayer);

  return { updatedLayers: result, groupId };
}

/**
 * Toggle mask on a layer. For groups, this clips children to the group bounds.
 * For shapes/images, it converts them to a clip-path mask.
 */
export function toggleLayerMask(
  layers: LayerType[],
  elementProperties: Record<string, ElementProperties>,
  layerId: string,
): { updatedLayers: LayerType[]; updatedProperties: Record<string, ElementProperties> } | null {
  const layer = layers.find((l) => l.id === layerId);
  if (!layer) return null;

  const currentMasked = layer.masked === true;
  const newMasked = !currentMasked;

  const updatedLayers = layers.map((l) =>
    l.id === layerId ? { ...l, masked: newMasked } as LayerType : l,
  );

  // The masked flag lives on the LayerType (see EditorContext), not on
  // element properties — pass properties through untouched.
  const updatedProperties = { ...elementProperties };

  return { updatedLayers, updatedProperties };
}
