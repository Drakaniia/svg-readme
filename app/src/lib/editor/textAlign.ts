import type { TextElementProperties } from "../../components/editor-canvas/ElementsRenderer";

/**
 * Shared text-alignment helpers — single source of truth so the canvas
 * renderer (ElementsRenderer), the SVG exporter (export.ts), and the text
 * editing overlay (TextOverlay) never drift apart.
 */

export const TEXT_ANCHOR_MAP: Record<string, "start" | "middle" | "end"> = {
  left: "start",
  center: "middle",
  right: "end",
  // Justify anchors like left for single-line text. True justification needs
  // line boxes with word spacing; this editor renders single-line text, so
  // justify falls back to left-aligned output (same behavior as open-pencil
  // on one line). Canvas and export intentionally produce identical output.
  justify: "start",
};

/**
 * Compute the SVG <text> x position within the box for a horizontal alignment.
 * x=0 is the box's left edge (the <g transform> origin).
 */
export function getTextXWithinBox(props: TextElementProperties, boxWidth: number): number {
  const anchor = TEXT_ANCHOR_MAP[props.textAlign] ?? "start";
  if (anchor === "middle") return boxWidth / 2;
  if (anchor === "end") return boxWidth;
  return 0;
}

/**
 * Compute the SVG <text> baseline y (relative to the box top) for a given
 * vertical alignment. SVG text y is the baseline; glyph tops sit ~0.8*fontSize
 * above it, so TOP places the baseline at fontSize (current behavior),
 * CENTER centers the line block, and BOTTOM pins it to the box bottom.
 */
export function getTextBaselineY(props: TextElementProperties): number {
  const align = props.textAlignVertical ?? "top";
  if (align === "center") return (props.height + props.fontSize) / 2;
  if (align === "bottom") return props.height;
  return props.fontSize;
}

/**
 * Vertical offset (px from box top) for a multi-line text block, matching
 * open-pencil's textVerticalOffset: CENTER centers the block, BOTTOM pins the
 * block bottom to the box bottom, TOP starts at 0.
 */
export function getTextVerticalOffset(
  boxHeight: number,
  blockHeight: number,
  textAlignVertical?: TextElementProperties["textAlignVertical"],
): number {
  const available = Math.max(0, boxHeight - blockHeight);
  if (textAlignVertical === "center") return available / 2;
  if (textAlignVertical === "bottom") return available;
  return 0;
}
