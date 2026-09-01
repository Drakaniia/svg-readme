import {
  Eye,
  Lock,
  EyeSlash,
  LockOpen,
  DotsSixVertical,
  Trash,
  CaretRight,
  CaretDown,
  FolderOpen,
} from "@phosphor-icons/react";
import type { LayerType } from "../../../context/EditorContext";

import { LayerIcon } from "./LayerIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DropPosition = "above" | "below" | "inside" | null;

interface LayerItemProps {
  layer: LayerType;
  depth: number;
  active: boolean;
  isDragged: boolean;
  isGroup: boolean;
  isCollapsed: boolean;
  hasChildren: boolean;
  childCount: number;
  isEmptyGroup: boolean;
  dropIndicatorClass: string;
  dropLine: React.ReactNode;
  indentLines: React.ReactNode[];
  editingLayerId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  saveEditing: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onToggleCollapse: (id: string, collapsed: boolean) => void;
  setLayers: React.Dispatch<React.SetStateAction<LayerType[]>>;
  onDeleteLayer: (e: React.MouseEvent, id: string) => void;
  toggleLock: (e: React.MouseEvent, id: string) => void;
  toggleVisibility: (e: React.MouseEvent, id: string) => void;
  startEditing: (e: React.MouseEvent, id: string, name: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LayerItem({
  layer,
  depth,
  active,
  isDragged,
  isGroup,
  isCollapsed,
  hasChildren,
  childCount,
  isEmptyGroup,
  dropIndicatorClass,
  dropLine,
  indentLines,
  editingLayerId,
  editingName,
  setEditingName,
  saveEditing,
  handleKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
  onContextMenu,
  onToggleCollapse,
  setLayers,
  onDeleteLayer,
  toggleLock,
  toggleVisibility,
  startEditing,
}: LayerItemProps) {
  return (
    <li
      key={layer.id}
      draggable
      onDragStart={(e) => onDragStart(e, layer.id)}
      onDragOver={(e) => onDragOver(e, layer.id)}
      onDrop={(e) => onDrop(e, layer.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(layer.id)}
      onContextMenu={(e) => onContextMenu(e, layer.id)}
      className={`relative flex items-center justify-between px-3 py-2.5 rounded-md text-sm cursor-pointer transition-all duration-150 group ${
        active ? "bg-blue-600/10 text-blue-400" : "text-zinc-300 hover:bg-white/5"
      } ${isDragged ? "opacity-40" : dropIndicatorClass || ""}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      {indentLines}
      {dropLine}

      <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
        <div className="cursor-grab active:cursor-grabbing text-zinc-600 group-hover:text-zinc-400 shrink-0">
          <DotsSixVertical className="w-3 h-3" />
        </div>

        {isGroup && hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newCollapsed = !isCollapsed;
              onToggleCollapse(layer.id, newCollapsed);
              setLayers((prev) => prev.map((l) => l.id === layer.id ? { ...l, collapsed: newCollapsed } : l));
            }}
            className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isCollapsed ? <CaretRight className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
          </button>
        ) : isEmptyGroup ? (
          <div className="w-3.5 flex items-center justify-center shrink-0">
            <FolderOpen className="w-3 h-3 text-zinc-500" />
          </div>
        ) : isGroup ? (
          <div className="w-3.5 flex items-center justify-center shrink-0">
            <FolderOpen className="w-3 h-3 text-blue-400" />
          </div>
        ) : (
          <div className="w-3.5 flex items-center justify-center shrink-0">
            <LayerIcon type={layer.type} className="w-3 h-3" />
          </div>
        )}

        {editingLayerId === layer.id ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={saveEditing}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 min-w-0 bg-black/20 border border-blue-500 rounded px-1 text-sm text-white outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`truncate flex-1 min-w-0 ${layer.visible ? "" : "opacity-40"} ${layer.masked ? "italic" : ""}`}
            onDoubleClick={(e) => startEditing(e, layer.id, layer.name)}
          >
            {layer.name}
          </span>
        )}

        {isGroup && (
          <span
            className={`shrink-0 text-[10px] font-mono rounded px-1.5 py-0.5 ${
              hasChildren ? "text-zinc-500 bg-zinc-800/80 border border-white/5" : "text-zinc-600 bg-transparent"
            }`}
            title={hasChildren ? `${childCount} child${childCount !== 1 ? "ren" : ""}` : "Empty group — drag layers here"}
          >
            {hasChildren ? childCount : "0"}
          </span>
        )}
      </div>

      <div
        className={`flex items-center gap-1.5 transition-opacity ml-2 shrink-0 ${
          active || layer.locked || !layer.visible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {layer.masked && (
          <span className="text-[9px] text-amber-500/70 font-mono px-1" title="Masked">M</span>
        )}
        <button
          onClick={(e) => onDeleteLayer(e, layer.id)}
          className="hover:text-red-400 transition-colors flex items-center justify-center text-zinc-500 hover:bg-white/5 p-1 rounded"
          title="Delete Layer"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => toggleLock(e, layer.id)}
          className="hover:text-white transition-colors flex items-center justify-center p-1 rounded hover:bg-white/5"
          title={layer.locked ? "Unlock Layer" : "Lock Layer"}
        >
          {layer.locked ? <Lock className="w-3.5 h-3.5 text-zinc-500" /> : <LockOpen className="w-3.5 h-3.5 text-zinc-600 opacity-40 hover:opacity-100" />}
        </button>
        <button
          onClick={(e) => toggleVisibility(e, layer.id)}
          className="hover:text-white transition-colors flex items-center justify-center p-1 rounded hover:bg-white/5"
          title={layer.visible ? "Hide Layer" : "Show Layer"}
        >
          {layer.visible ? <Eye className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" /> : <EyeSlash className="w-3.5 h-3.5 text-zinc-600 opacity-40 hover:opacity-100" />}
        </button>
      </div>
    </li>
  );
}
