import { useEffect, useLayoutEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextOverlayProps {
  /** The text layer ID being edited */
  layerId: string;
  /** Current text content */
  content: string;
  /** Position and size of the overlay */
  x: number;
  y: number;
  width: number | "auto";
  height: number;
  /** Text styling */
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  /** Background fill of the text box (hex). Shows as overlay background. */
  backgroundColor?: string;
  textAlign: "left" | "center" | "right";
  /** Called with updated content on change */
  onChange: (content: string) => void;
  /** Called when editing should commit/blur */
  onCommit: () => void;
}

// Note: Escape now commits (calls onCommit), matching Figma behavior.

// ─── Component ───────────────────────────────────────────────────────────────

export default function TextOverlay({
  layerId,
  content,
  x,
  y,
  width,
  fontFamily,
  fontSize,
  fontWeight,
  color,
  backgroundColor,
  textAlign,
  onChange,
  onCommit,
}: TextOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute overlay width — use fixed width if set, otherwise auto-size
  const overlayWidth =
    width === "auto"
      ? Math.max(content.length * fontSize * 0.6 + 16, 60)
      : width;
      
  const adjustedY = y - fontSize - 4;

  let adjustedX = x - 4;
  if (textAlign === "center") {
    adjustedX = x - overlayWidth / 2;
  } else if (textAlign === "right") {
    adjustedX = x - overlayWidth;
  }

  // Auto-focus on mount
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, [layerId]);

  // Auto-resize the textarea height whenever content changes.
  // Uses useLayoutEffect so the resize happens synchronously before paint,
  // preventing a visible flash of incorrect sizing.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      // Reset to auto first so scrollHeight reports the actual content height
      el.style.height = "auto";
      el.style.height = Math.max(el.scrollHeight, fontSize * 1.6) + "px";
    }
  }, [content, fontSize]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      // Figma behavior: Escape commits the text, doesn't discard it
      onCommit();
    }
  };

  // Handle blur (click outside) → commit
  const handleBlur = () => {
    onCommit();
  };

  return (
    <div
      className="absolute z-50"
      style={{
        left: adjustedX,
        top: adjustedY,
        width: overlayWidth,
        minWidth: 60,
        minHeight: fontSize * 1.6,
        // Use the text box background fill if set, otherwise the blue editing indicator
        background: backgroundColor ?? "rgba(59, 130, 246, 0.06)",
        border: backgroundColor
          ? "1px solid rgba(255, 255, 255, 0.15)"
          : "1px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "2px",
        padding: "4px",
      }}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full resize-none overflow-hidden"
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily,
          fontSize,
          fontWeight,
          color,
          textAlign,
          lineHeight: 1.4,
          padding: 0,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          caretColor: color,
        }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        rows={1}
      />
    </div>
  );
}
