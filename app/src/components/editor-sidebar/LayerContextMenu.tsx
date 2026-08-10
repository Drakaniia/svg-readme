import { useState, useCallback, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  separator?: false;
  children?: ContextMenuAction[];
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator;

interface LayerContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LayerContextMenu({
  x,
  y,
  onClose,
  items,
}: LayerContextMenuProps) {
  const [subMenuOpen, setSubMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setSubMenuOpen(null);
    onClose();
  }, [onClose]);

  // Close on click outside or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [handleClose]);

  // Adjust position to stay within viewport
  const adjustedPos = useAdjustedPosition(x, y, menuRef);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.4)] py-1.5 animate-in fade-in zoom-in-95 origin-top-left"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {items.map((item, index) => {
        if ("separator" in item && item.separator) {
          return (
            <div
              key={`sep-${index}`}
              className="my-1 mx-2 h-px bg-white/5"
            />
          );
        }

        const action = item as ContextMenuAction;

        if (action.children && action.children.length > 0) {
          return (
            <div key={action.id} className="relative">
              <button
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  action.disabled
                    ? "text-zinc-600 cursor-not-allowed"
                    : action.destructive
                      ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                }`}
                disabled={action.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setSubMenuOpen(
                    subMenuOpen === action.id ? null : action.id,
                  );
                }}
                onMouseEnter={() => setSubMenuOpen(action.id)}
              >
                <span className="flex items-center gap-2.5">
                  {action.icon && (
                    <span className="w-4 h-4 flex items-center justify-center text-zinc-400">
                      {action.icon}
                    </span>
                  )}
                  <span>{action.label}</span>
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-500 ml-4"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              {subMenuOpen === action.id && (
                <div className="absolute left-full top-0 ml-1 min-w-[180px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.4)] py-1.5">
                  {action.children.map((child) => (
                    <button
                      key={child.id}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        child.disabled
                          ? "text-zinc-600 cursor-not-allowed"
                          : child.destructive
                            ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                      disabled={child.disabled}
                      onClick={() => {
                        if (!child.disabled) {
                          handleClose();
                          // Trigger the action
                          window.dispatchEvent(
                            new CustomEvent("layer-context-action", {
                              detail: { actionId: child.id },
                            }),
                          );
                        }
                      }}
                    >
                      {child.icon && (
                        <span className="w-4 h-4 flex items-center justify-center text-zinc-400">
                          {child.icon}
                        </span>
                      )}
                      <span>{child.label}</span>
                      {child.shortcut && (
                        <span className="ml-auto text-[10px] text-zinc-500 font-mono">
                          {child.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={action.id}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
              action.disabled
                ? "text-zinc-600 cursor-not-allowed"
                : action.destructive
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
            }`}
            disabled={action.disabled}
            onClick={() => {
              if (!action.disabled) {
                handleClose();
                window.dispatchEvent(
                  new CustomEvent("layer-context-action", {
                    detail: { actionId: action.id },
                  }),
                );
              }
            }}
          >
            <span className="flex items-center gap-2.5">
              {action.icon && (
                <span className="w-4 h-4 flex items-center justify-center text-zinc-400">
                  {action.icon}
                </span>
              )}
              <span>{action.label}</span>
            </span>
            {action.shortcut && (
              <span className="ml-4 text-[10px] text-zinc-500 font-mono tracking-wider">
                {action.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Hook: Adjust position to stay within viewport ─────────────────────────────

function useAdjustedPosition(
  x: number,
  y: number,
  ref: React.RefObject<HTMLElement | null>,
) {
  const [pos, setPos] = useState({ x, y });
  const [hasMeasured, setHasMeasured] = useState(false);

  useEffect(() => {
    // On first render after mount, measure and adjust
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > vw) adjustedX = Math.max(4, vw - rect.width - 8);
    if (y + rect.height > vh) adjustedY = Math.max(4, vh - rect.height - 8);

    if (!hasMeasured) {
      // Legitimate measure-layout-then-set-state effect: stores the clamped
      // position once the menu has been painted so it never overflows.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasMeasured(true);
      setPos({ x: adjustedX, y: adjustedY });
    }
  }, [x, y, ref, hasMeasured]);

  // Also compute a fallback inline if ref isn't available yet
  if (!hasMeasured) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estimatedWidth = 200;
    const estimatedHeight = 400;
    let adjustedX = x;
    let adjustedY = y;
    if (x + estimatedWidth > vw) adjustedX = Math.max(4, vw - estimatedWidth - 8);
    if (y + estimatedHeight > vh) adjustedY = Math.max(4, vh - estimatedHeight - 8);
    return { x: adjustedX, y: adjustedY };
  }

  return pos;
}

// ─── Re-export context menu builder ────────────────────────────────────────────
export { buildLayerContextMenu, type LayerActionCallbacks } from "./contextMenuItems";
