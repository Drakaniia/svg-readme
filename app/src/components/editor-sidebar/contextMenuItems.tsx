import {
  Copy,
  Trash,
  ArrowFatLineUp,
  ArrowFatLineDown,
  ArrowUp,
  ArrowDown,
  Stack,
  StackSimple,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  List,
  FrameCorners,
  Clipboard,
} from "@phosphor-icons/react";
import type { ContextMenuItem } from "./LayerContextMenu";

export interface LayerActionCallbacks {
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBringForward?: () => void;
  onBringToFront?: () => void;
  onSendBackward?: () => void;
  onSendToBack?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onToggleVisibility?: () => void;
  onToggleLock?: () => void;
  onFlatten?: () => void;
  onOutlineText?: () => void;
  onOutlineStroke?: () => void;
  onWrapInFrame?: () => void;
  onToggleMask?: () => void;
  onBooleanUnion?: () => void;
  onBooleanSubtract?: () => void;
  onBooleanIntersect?: () => void;
  onBooleanExclude?: () => void;
  onCopyAsPng?: () => void;
}

export function buildLayerContextMenu(
  options: {
    isGroup?: boolean;
    isText?: boolean;
    isShape?: boolean;
    isPath?: boolean;
    isImage?: boolean;
    isLocked?: boolean;
    isVisible?: boolean;
    canGroup?: boolean;
    canUngroup?: boolean;
    multiSelected?: boolean;
    /** ≥2 selected shape/path layers — enables real boolean ops. */
    canBoolean?: boolean;
    /** Selected layer can act as a mask (shape/path/text inside a group). */
    canMask?: boolean;
    /** Selected layer is a text element — enables Outline Text. */
    canOutlineText?: boolean;
    /** Selected layer is a shape/path — enables Outline Stroke. */
    canOutlineStroke?: boolean;
  } = {},
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // ── Group 1: Cut/Copy/Duplicate/Delete ──────────────────────────────────
  items.push(
    {
      id: "duplicate",
      label: "Duplicate",
      icon: <Copy className="w-3.5 h-3.5" />,
      shortcut: "\u2318D",
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash className="w-3.5 h-3.5" />,
      shortcut: "\u232B",
      destructive: true,
    },
  );

  items.push({ separator: true });

  // ── Group 2: Ordering ──────────────────────────────────────────────────
  items.push(
    {
      id: "bringToFront",
      label: "Bring to Front",
      icon: <ArrowFatLineUp className="w-3.5 h-3.5" />,
      shortcut: "\u2318\u21E7]",
    },
    {
      id: "bringForward",
      label: "Bring Forward",
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      shortcut: "\u2318]",
    },
    {
      id: "sendBackward",
      label: "Send Backward",
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      shortcut: "\u2318[",
    },
    {
      id: "sendToBack",
      label: "Send to Back",
      icon: <ArrowFatLineDown className="w-3.5 h-3.5" />,
      shortcut: "\u2318\u21E7[",
    },
  );

  items.push({ separator: true });

  // ── Group 3: Group/Ungroup/Frame/Boolean ────────────────────────────────
  if (options.canGroup) {
    items.push({
      id: "group",
      label: "Group Selection",
      icon: <Stack className="w-3.5 h-3.5" />,
      shortcut: "\u2318G",
    });
  }
  if (options.canUngroup) {
    items.push({
      id: "ungroup",
      label: "Ungroup",
      icon: <StackSimple className="w-3.5 h-3.5" />,
      shortcut: "\u2318\u21E7G",
    });
  }

  items.push(
    {
      id: "wrapInFrame",
      label: "Frame Selection",
      icon: <FrameCorners className="w-3.5 h-3.5" />,
    },
    {
      id: "flatten",
      label: "Flatten",
      icon: <List className="w-3.5 h-3.5" />,
      disabled: !options.isGroup,
    },
  );

  // ── Group 3b: Boolean ops / masks / outlines ───────────────────────────
  if (options.canBoolean) {
    items.push({
      id: "boolean",
      label: "Boolean",
      icon: <List className="w-3.5 h-3.5" />,
      children: [
        { id: "booleanUnion", label: "Union" },
        { id: "booleanSubtract", label: "Subtract" },
        { id: "booleanIntersect", label: "Intersect" },
        { id: "booleanExclude", label: "Exclude" },
      ],
    });
  }
  if (options.canOutlineText || options.canOutlineStroke) {
    if (options.canOutlineText) {
      items.push({ id: "outlineText", label: "Outline Text" });
    }
    if (options.canOutlineStroke) {
      items.push({ id: "outlineStroke", label: "Outline Stroke" });
    }
  }
  if (options.canMask) {
    items.push({
      id: "toggleMask",
      label: "Use as Mask",
      icon: <FrameCorners className="w-3.5 h-3.5" />,
    });
  }

  items.push({ separator: true });

  // ── Group 4: Visibility / Lock / Copy as PNG ────────────────────────────
  items.push(
    {
      id: "toggleVisibility",
      label: options.isVisible ? "Hide" : "Show",
      icon: options.isVisible ? (
        <EyeSlash className="w-3.5 h-3.5" />
      ) : (
        <Eye className="w-3.5 h-3.5" />
      ),
    },
    {
      id: "toggleLock",
      label: options.isLocked ? "Unlock" : "Lock",
      icon: options.isLocked ? (
        <LockOpen className="w-3.5 h-3.5" />
      ) : (
        <Lock className="w-3.5 h-3.5" />
      ),
    },
  );

  items.push({ separator: true });

  items.push({
    id: "copyAsPng",
    label: "Copy as PNG",
    icon: <Clipboard className="w-3.5 h-3.5" />,
  });

  return items;
}
