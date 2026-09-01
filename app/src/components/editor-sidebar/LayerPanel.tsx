import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Stack,
  Eye,
  LockOpen,
  Plus,
  FolderPlus,
  MagnifyingGlass,
  X,
  ArrowsDownUp,
  EyeSlash as EyeOffAll,
  Lock as LockAll,
} from "@phosphor-icons/react";
import LayerContextMenu, {
  buildLayerContextMenu,
  type ContextMenuItem,
} from "./LayerContextMenu";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../editor-canvas/ElementsRenderer";

import { LayerItem, type DropPosition } from "./LayerPanel/LayerItem";
import { ToolbarBtn, ContextActionListener } from "./LayerPanel/Toolbar";

interface LayerPanelProps {
  layers: LayerType[];
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  /** Layer properties used to decide which context-menu ops apply (boolean, masks…). */
  elementProperties?: Record<string, ElementProperties>;
  onAdd?: (layer: LayerType, insertIndex: number) => void;
  onReorder?: (ordered: { id: string; orderIndex: number }[]) => void;
  onRename?: (id: string, name: string) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onToggleLock?: (id: string, locked: boolean) => void;
  onDelete?: (id: string) => void;
  onToggleCollapse?: (id: string, collapsed: boolean) => void;
  /** Called when a context menu action is triggered */
  onContextAction?: (actionId: string, layerId: string) => void;
  /** Called when a layer row is clicked — syncs the editor selection. */
  onSelectLayer?: (id: string) => void;
  /** Called when clicking empty space in the panel — clears the selection. */
  onClearSelection?: () => void;
}

// ─── Drop indicator types ─────────────────────────────────────────────────────

interface DragOverState {
  targetId: string;
  position: DropPosition;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LayerPanel({
  layers,
  setLayers,
  elementProperties = {},
  onAdd,
  onReorder,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onToggleCollapse,
  onContextAction,
  onSelectLayer,
  onClearSelection,
}: LayerPanelProps) {
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DragOverState | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    layerId: string;
  } | null>(null);

  // Build children lookup for group nesting (memoized so the F2-rename effect's
  // layerById dep stays stable across renders)
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, string[]>();
    for (const layer of layers) {
      const parentKey = layer.parentId ?? null;
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey)!.push(layer.id);
    }
    return map;
  }, [layers]);
  const layerById = useMemo(
    () => new Map(layers.map((l) => [l.id, l])),
    [layers],
  );

  const isSelected = useCallback(
    (id: string) => layerById.get(id)?.active === true,
    [layerById],
  );

  // ── Search filtering ─────────────────────────────────────────────────────
  // A query filters the tree to matching layers + their ancestors (so matches
  // remain visible in context) and forces matching subtrees to expand.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return null;
    const matches = new Set<string>();
    // Collect matching layer ids
    for (const layer of layers) {
      if (layer.name.toLowerCase().includes(normalizedQuery)) {
        matches.add(layer.id);
      }
    }
    // Add ancestors of matches so nested results stay visible
    let grew = true;
    while (grew) {
      grew = false;
      for (const layer of layers) {
        if (matches.has(layer.id) && layer.parentId && !matches.has(layer.parentId)) {
          matches.add(layer.parentId);
          grew = true;
        }
      }
    }
    return matches;
  }, [layers, normalizedQuery]);

  /** True when a layer should be hidden by the active search query. */
  const isFilteredOut = (id: string): boolean =>
    searchMatches !== null && !searchMatches.has(id);

  /** During search, matching subtrees are always expanded. */
  const effectiveCollapsed = (layer: LayerType): boolean => {
    if (searchMatches && searchMatches.has(layer.id)) return false;
    return layer.collapsed === true;
  };

  // ── Build context menu items for a specific layer ─────────────────────────
  const buildMenuItems = (layerId: string): ContextMenuItem[] => {
    const layer = layerById.get(layerId);
    if (!layer) return [];

    const selectedIds = layers.filter((l) => l.active).map((l) => l.id);
    const canGroup = selectedIds.length >= 2;
    const canUngroup = layer.type === "group";
    const selectedProps = selectedIds
      .map((id) => elementProperties[id])
      .filter((p): p is ElementProperties => Boolean(p));
    const selectedShapeOrPathCount = selectedProps.filter(
      (p) => p.type === "shape" || p.type === "path",
    ).length;
    const layerProps = elementProperties[layerId];

    return buildLayerContextMenu(
      {
        isGroup: layer.type === "group",
        isText: layer.type === "text",
        isShape: layer.type === "shape",
        isImage: layer.type === "image",
        isLocked: layer.locked,
        isVisible: layer.visible,
        canGroup,
        canUngroup,
        multiSelected: selectedIds.length > 1,
        canBoolean: selectedShapeOrPathCount >= 2,
        canMask:
          Boolean(layer.parentId) &&
          (layer.type === "shape" || layer.type === "text"),
        canOutlineText: layer.type === "text" && Boolean(layerProps),
        // Paths are stored as shape-typed layers (props.type === "path").
        canOutlineStroke: layer.type === "shape" && Boolean(layerProps),
      },
    );
  };

  // ── Context menu handlers ────────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, layerId: string) => {
      e.preventDefault();
      e.stopPropagation();

      // If this layer is not already selected, select it
      if (!isSelected(layerId)) {
        setLayers((prev) =>
          prev.map((l) => ({ ...l, active: l.id === layerId })),
        );
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        layerId,
      });
    },
    [isSelected, setLayers],
  );

  const handleContextAction = useCallback(
    (actionId: string) => {
      if (contextMenu) {
        onContextAction?.(actionId, contextMenu.layerId);
      }
    },
    [contextMenu, onContextAction],
  );

  // ── Drag and drop handlers ──────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLayerId(id);
    e.dataTransfer.effectAllowed = "move";
    // Use a tiny transparent image as drag image for cleaner UX
    const dragImg = new window.Image();
    dragImg.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";
    e.dataTransfer.setDragImage(dragImg, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!draggedLayerId || draggedLayerId === targetId) {
      setDragOver(null);
      return;
    }

    // Calculate position relative to the target element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const threshold = height / 3;

    let position: DropPosition;
    if (y < threshold) {
      position = "above";
    } else if (y > height - threshold) {
      position = "below";
    } else {
      position = "inside";
    }

    setDragOver({ targetId, position });

    // Auto-expand collapsed groups while hovering over their middle zone,
    // so dropping "inside" is always available (Figma behavior).
    const target = layerById.get(targetId);
    if (position === "inside" && target?.type === "group" && target.collapsed) {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === targetId ? { ...l, collapsed: false } : l,
        ),
      );
      onToggleCollapse?.(targetId, false);
    }
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === dropId) {
      setDraggedLayerId(null);
      setDragOver(null);
      return;
    }

    const position = dragOver?.position ?? "below";

    setLayers((prev) => {
      const draggedIndex = prev.findIndex((l) => l.id === draggedLayerId);
      const dropIndex = prev.findIndex((l) => l.id === dropId);

      if (draggedIndex === -1 || dropIndex === -1) return prev;

      const newLayers = [...prev];
      const [draggedLayer] = newLayers.splice(draggedIndex, 1);

      let insertIndex = dropIndex;
      if (position === "below") insertIndex = dropIndex + 1;

      // If "inside", set parent to the target group
      if (position === "inside") {
        const target = prev[dropIndex];
        if (target.type === "group") {
          draggedLayer.parentId = target.id;
        }
      } else {
        // Match parent of the drop target
        draggedLayer.parentId = prev[dropIndex].parentId ?? null;
      }

      newLayers.splice(insertIndex, 0, draggedLayer);

      // Notify parent to persist new order
      onReorder?.(newLayers.map((l, i) => ({ id: l.id, orderIndex: i })));

      return newLayers;
    });

    setDraggedLayerId(null);
    setDragOver(null);
  };

  const handleDragEnd = () => {
    setDraggedLayerId(null);
    setDragOver(null);
  };

  // ── Action handlers ──────────────────────────────────────────────────────
  const toggleVisibility = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        onToggleVisibility?.(id, !l.visible);
        return { ...l, visible: !l.visible };
      }),
    );
  };

  const toggleLock = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        onToggleLock?.(id, !l.locked);
        return { ...l, locked: !l.locked };
      }),
    );
  };

  const setActiveLayer = (id: string) => {
    setLayers((prev) => prev.map((l) => ({ ...l, active: l.id === id })));
    // Keep the editor's selection state in sync — otherwise the layer only
    // highlights in the panel and the canvas/right-bar never see it selected.
    onSelectLayer?.(id);
  };

  const handleAddLayer = () => {
    const newLayer: LayerType = {
      id: Date.now().toString(),
      name: "New Layer",
      type: "shape",
      locked: false,
      visible: true,
      active: true,
      parentId: null,
    };
    setLayers((prev) => {
      const activeIndex = prev.findIndex((l) => l.active);
      const insertIndex = activeIndex >= 0 ? activeIndex : 0;
      const newLayers = prev.map((l) => ({ ...l, active: false }) as LayerType);
      newLayers.splice(insertIndex, 0, newLayer);
      onAdd?.(newLayer, insertIndex);
      return newLayers;
    });
  };

  // ── Add empty group (Open Pencil style: creates a container on the canvas) ──
  const handleAddGroup = () => {
    const newGroup: LayerType = {
      id: `group-${Date.now()}`,
      name: "Group",
      type: "group",
      locked: false,
      visible: true,
      active: true,
      parentId: null,
      collapsed: false,
    };
    setLayers((prev) => {
      const activeIndex = prev.findIndex((l) => l.active);
      const insertIndex = activeIndex >= 0 ? activeIndex + 1 : prev.length;
      const newLayers = prev.map((l) => ({ ...l, active: false }) as LayerType);
      newLayers.splice(insertIndex, 0, newGroup);
      onAdd?.(newGroup, insertIndex);
      return newLayers;
    });
  };

  const handleDeleteLayer = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete?.(id);
    setLayers((prev) => prev.filter((l) => l.id !== id));
  };

  const startEditing = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingLayerId(id);
    setEditingName(name);
  };

  const saveEditing = () => {
    if (editingLayerId) {
      const newName = editingName.trim() || "Untitled Layer";
      onRename?.(editingLayerId, newName);
      setLayers((prev) =>
        prev.map((l) =>
          l.id === editingLayerId ? { ...l, name: newName } : l,
        ),
      );
      setEditingLayerId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditing();
    } else if (e.key === "Escape") {
      setEditingLayerId(null);
    }
  };

  // ── Listen for F2 rename keyboard shortcut ────────────────────────────────
  const layerByIdRef = useRef(layerById);
  useEffect(() => { layerByIdRef.current = layerById; }, [layerById]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { layerId: string };
      const layer = layerByIdRef.current.get(detail.layerId);
      if (layer) {
        setEditingLayerId(layer.id);
        setEditingName(layer.name);
      }
    };
    window.addEventListener("layer-rename-start", handler);
    return () => window.removeEventListener("layer-rename-start", handler);
  }, []);

  // ── Drop indicator renderer ─────────────────────────────────────────────
  const getDropIndicatorClass = (layerId: string): string => {
    if (dragOver?.targetId !== layerId) return "";
    if (dragOver.position === "inside") {
      return "ring-1 ring-inset ring-blue-500/40 bg-blue-500/8";
    }
    return "";
  };

  /** Render a drop line bar above or below the target row. */
  const renderDropLine = (layerId: string, _depth: number): React.ReactNode => {
    if (dragOver?.targetId !== layerId) return null;
    if (dragOver.position === "above") {
      return (
        <div
          className="absolute left-2 right-2 top-0 h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
          style={{}}
        />
      );
    }
    if (dragOver.position === "below") {
      return (
        <div
          className="absolute left-2 right-2 -bottom-px h-0.5 bg-blue-500 rounded-full z-10 pointer-events-none"
        />
      );
    }
    return null;
  };

  /** Render tree indent connector lines (like file explorer tree guides). */
  function renderIndentLines(
    parentId: string | null,
    depth: number,
  ): React.ReactNode[] {
    if (depth <= 0) return [];
    // Walk up ancestors to determine which rows need a vertical connector
    const lines: React.ReactNode[] = [];
    let currentParentId = parentId;
    for (let d = depth - 1; d >= 0; d--) {
      if (!currentParentId) break;
      const parent = layerById.get(currentParentId);
      if (!parent) break;
      // Check if this parent has a next sibling (so the line continues)
      const grandparentId = parent.parentId ?? null;
      const siblings = childrenMap.get(grandparentId) ?? [];
      const parentIndex = siblings.indexOf(parent.id);
      const hasNextSibling = parentIndex >= 0 && parentIndex < siblings.length - 1;
      if (hasNextSibling) {
        lines.push(
          <div
            key={`line-${parent.id}-${d}`}
            className="absolute top-0 bottom-0 w-px bg-white/5 pointer-events-none"
            style={{ left: `${12 + d * 16 + 7}px` }}
          />,
        );
      }
      currentParentId = parent.parentId ?? null;
    }
    return lines;
  }

  /** Recursively render layers starting from a parent ID */
  function renderLayers(
    parentId: string | null,
    depth: number,
  ): React.ReactNode[] {
    const childIds = childrenMap.get(parentId) ?? [];
    return childIds.flatMap((id, _idx) => {
      const layer = layerById.get(id);
      if (!layer) return [];
      // Skip layers filtered out by the active search query
      if (isFilteredOut(id)) return [];
      const isGroup = layer.type === "group";
      const isCollapsed = effectiveCollapsed(layer);
      const hasChildren =
        childrenMap.has(id) && (childrenMap.get(id)?.length ?? 0) > 0;
      const childCount = childrenMap.get(id)?.length ?? 0;
      const active = layer.active === true;
      const isDragged = draggedLayerId === layer.id;
      const isEmptyGroup = isGroup && !hasChildren;

      const dropIndicatorClass = getDropIndicatorClass(layer.id);
      const dropLine = renderDropLine(layer.id, depth);
      const indentLines = renderIndentLines(parentId, depth);

      const layerEl = (
        <LayerItem
          layer={layer}
          depth={depth}
          active={active}
          isDragged={isDragged}
          isGroup={isGroup}
          isCollapsed={isCollapsed}
          hasChildren={hasChildren}
          childCount={childCount}
          isEmptyGroup={isEmptyGroup}
          dropIndicatorClass={dropIndicatorClass}
          dropLine={dropLine}
          indentLines={indentLines}
          editingLayerId={editingLayerId}
          editingName={editingName}
          setEditingName={setEditingName}
          saveEditing={saveEditing}
          handleKeyDown={handleKeyDown}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onClick={setActiveLayer}
          onContextMenu={handleContextMenu}
          onToggleCollapse={onToggleCollapse ?? (() => {})}
          setLayers={setLayers}
          onDeleteLayer={handleDeleteLayer}
          toggleLock={toggleLock}
          toggleVisibility={toggleVisibility}
          startEditing={startEditing}
        />
      );

      // Render children if group is expanded (or for root level always)
      const children =
        isGroup && isCollapsed ? [] : renderLayers(id, depth + 1);
      return [layerEl, ...children];
    });
  }

  // ── Bulk layer actions ───────────────────────────────────────────────────
  const setAllCollapsed = (collapsed: boolean) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.type === "group" ? { ...l, collapsed } : l,
      ),
    );
  };

  const setAllVisible = (visible: boolean) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.visible === visible) return l;
        onToggleVisibility?.(l.id, visible);
        return { ...l, visible };
      }),
    );
  };

  const setAllLocked = (locked: boolean) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.locked === locked) return l;
        onToggleLock?.(l.id, locked);
        return { ...l, locked };
      }),
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] font-[JetBrains_Mono] text-zinc-500 uppercase font-semibold tracking-wider">
          <Stack className="w-3.5 h-3.5" />
          Layers
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleAddLayer}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            title="Add Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddGroup}
            className="p-1 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-white/5 transition-colors"
            title="Add Group"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search field */}
      <div className="px-5 pt-3 pb-1">
        <div className="relative flex items-center">
          <MagnifyingGlass className="absolute left-3 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search layers…"
            className="w-full bg-zinc-900/80 border border-white/5 rounded-md pl-8 pr-8 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-zinc-600 hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action toolbar */}
      <div className="px-5 py-2 flex items-center gap-1 border-b border-white/5">
        <ToolbarBtn onClick={() => setAllCollapsed(true)} title="Collapse all groups">
          <ArrowsDownUp className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setAllCollapsed(false)} title="Expand all groups">
          <ArrowsDownUp className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <div className="flex-1" />
        <ToolbarBtn onClick={() => setAllVisible(true)} title="Show all layers">
          <Eye className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setAllVisible(false)} title="Hide all layers">
          <EyeOffAll className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setAllLocked(true)} title="Lock all layers">
          <LockAll className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setAllLocked(false)} title="Unlock all layers">
          <LockOpen className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>

      <div
        className="flex-1 py-3 overflow-y-auto overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClearSelection?.();
        }}
      >
        {layers.filter((l) => (l.parentId ?? null) === null).length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-zinc-500">
              No layers yet. Draw on the canvas or click + to add one.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 px-3">{renderLayers(null, 0)}</ul>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop to catch clicks outside */}
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <LayerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={buildMenuItems(contextMenu.layerId)}
          />
        </>
      )}

      {/* Context menu action listener */}
      <ContextActionListener
        active={contextMenu !== null}
        onAction={(actionId) => handleContextAction(actionId)}
      />
    </div>
  );
}

