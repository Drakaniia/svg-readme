import { useEffect, useLayoutEffect, useRef } from "react";
import { measureTextWidth } from "../../lib/editor/textMeasure";

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
  textAlign: "left" | "center" | "right" | "justify";
  /** Vertical alignment inside the text box */
  textAlignVertical?: "top" | "center" | "bottom";
  /** Text box resizing behavior: auto modes let the box hug the content. */
  textAutoResize?: "NONE" | "HEIGHT" | "WIDTH_AND_HEIGHT";
  lineHeight?: number;
  letterSpacing?: number;
  italic?: boolean;
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
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
  height,
  fontFamily,
  fontSize,
  fontWeight,
  color,
  backgroundColor,
  textAlign,
  textAlignVertical = "top",
  textAutoResize = "NONE",
  lineHeight,
  letterSpacing = 0,
  italic = false,
  textDecoration = "NONE",
  textCase = "ORIGINAL",
  onChange,
  onCommit,
}: TextOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute overlay width through the shared text measurement (A11) so the
  // editing box matches the rendered/exported box. fontSize is already zoomed
  // by the caller, so the measured width lands in screen pixels too.
  const overlayWidth =
    width === "auto"
      ? Math.max(
          content
            .split("\n")
            .reduce(
              (max, line) =>
                Math.max(
                  max,
                  measureTextWidth(line, {
                    fontFamily,
                    fontSize,
                    fontWeight,
                    italic,
                    letterSpacing,
                  }),
                ),
              0,
            ),
          20,
        )
      : width;

  // x,y is now the TOP-LEFT of the textbox (matching Open Pencil <g transform> pattern).
  // No more adjustedX/adjustedY hacks — the overlay sits exactly at the box origin.

  // Auto-focus on mount
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, [layerId]);

  // Auto-resize the textarea height whenever content changes.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(el.scrollHeight, fontSize * 1.6) + "px";
    }
  }, [content, fontSize]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCommit();
    }
  };

  // Handle blur (click outside) → commit
  const handleBlur = () => {
    onCommit();
  };

  // Vertical alignment: flex so the (auto-height) textarea sits at the top,
  // center, or bottom of the fixed-height box — mirrors open-pencil's vertical
  // text alignment in the editing overlay.
  const alignY =
    textAlignVertical === "center"
      ? "center"
      : textAlignVertical === "bottom"
        ? "flex-end"
        : "flex-start";

  // Auto-resize modes: the overlay box hugs the content (open-pencil resizes
  // the node while editing). Fixed (NONE) keeps the box height, growing only
  // when content overflows so typing is never clipped.
  const autoGrow = textAutoResize !== "NONE";
  const overlayHeight = autoGrow ? undefined : Math.max(height, fontSize * 1.6);

  const textTransform =
    textCase === "UPPER"
      ? "uppercase"
      : textCase === "LOWER"
        ? "lowercase"
        : textCase === "TITLE"
          ? "capitalize"
          : "none";

  return (
    <div
      className="absolute z-50 flex"
      style={{
        left: x,
        top: y,
        width: overlayWidth,
        minWidth: 60,
        minHeight: height || fontSize * 1.4,
        height: overlayHeight,
        alignItems: alignY,
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
          fontStyle: italic ? "italic" : "normal",
          color,
          textAlign,
          textTransform,
          textDecoration:
            textDecoration === "UNDERLINE"
              ? "underline"
              : textDecoration === "STRIKETHROUGH"
                ? "line-through"
                : "none",
          letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
          lineHeight: lineHeight ? lineHeight / fontSize : 1.4,
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
