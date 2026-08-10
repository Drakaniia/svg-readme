import type { TextElementProperties } from "../../components/editor-canvas/ElementsRenderer";

/**
 * Text measurement + line layout helpers shared by the canvas renderer,
 * the SVG exporter, and the editor's auto-resize logic — a single source of
 * truth so on-canvas rendering, exported SVG, and the editing overlay agree.
 *
 * Model mirrors open-pencil: content may span multiple lines, a fixed-width
 * box wraps words, and textAutoResize decides how the box hugs the content.
 */

export type TextLine = {
  /** Text of this line (already case-transformed). */
  text: string;
  /** Rendered width in px (measured or estimated). */
  width: number;
};

/** Case transform — ported from open-pencil's transformTextCase. */
export function transformTextCase(text: string, textCase?: TextElementProperties["textCase"]): string {
  if (textCase === "UPPER") return text.toLocaleUpperCase();
  if (textCase === "LOWER") return text.toLocaleLowerCase();
  if (textCase === "TITLE") {
    return text.replace(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu, (word) =>
      word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase(),
    );
  }
  return text;
}

/** Resolve the effective line height (px) for a text element. */
export function getLineHeight(props: Pick<TextElementProperties, "lineHeight" | "fontSize">): number {
  return props.lineHeight && props.lineHeight > 0 ? props.lineHeight : props.fontSize * 1.4;
}

// ─── Measurement ─────────────────────────────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) {
    try {
      const canvas = document.createElement("canvas");
      measureCtx = canvas.getContext("2d");
    } catch {
      measureCtx = null; // jsdom and other non-canvas environments
    }
  }
  return measureCtx;
}

/** Best-effort font string for the measurement context. */
function fontString(props: Pick<TextElementProperties, "fontFamily" | "fontSize" | "fontWeight" | "italic">): string {
  return `${props.italic ? "italic " : ""}${props.fontWeight} ${props.fontSize}px ${props.fontFamily}`;
}

/**
 * Measure a single line of text in px. Uses canvas measureText when available;
 * falls back to the editor's heuristic (0.6 * fontSize per char + letterSpacing).
 */
export function measureTextWidth(
  text: string,
  props: Pick<TextElementProperties, "fontFamily" | "fontSize" | "fontWeight" | "italic" | "letterSpacing">,
): number {
  const spacing = (props.letterSpacing ?? 0) * Math.max(text.length - 1, 0);
  const ctx = getMeasureCtx();
  if (ctx) {
    ctx.font = fontString(props);
    return Math.ceil(ctx.measureText(text).width + spacing);
  }
  return Math.ceil(text.length * props.fontSize * 0.6 + spacing);
}

/**
 * Split + wrap content into display lines for a given box width.
 * - Newlines always break lines.
 * - When boxWidth is finite (> 0), long lines wrap on word boundaries.
 * - When auto (0 / undefined), lines are only broken by explicit newlines.
 * Returns lines with measured widths (case-transformed text).
 */
export function getTextLines(
  content: string,
  props: Pick<TextElementProperties, "fontFamily" | "fontSize" | "fontWeight" | "italic" | "letterSpacing" | "textCase">,
  boxWidth: number,
): TextLine[] {
  const text = transformTextCase(content, props.textCase);
  if (!text) return [];

  const wrap = boxWidth > 0;
  const lines: TextLine[] = [];
  for (const raw of text.split("\n")) {
    if (!wrap) {
      lines.push({ text: raw, width: measureTextWidth(raw, props) });
      continue;
    }
    const words = raw.split(/(\s+)/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push({ text: "", width: 0 });
      continue;
    }
    let current = "";
    let currentWidth = 0;
    const flush = () => {
      lines.push({ text: current, width: currentWidth });
      current = "";
      currentWidth = 0;
    };
    for (const word of words) {
      const w = measureTextWidth(word, props);
      if (current === "") {
        current = word;
        currentWidth = w;
      } else if (currentWidth + w <= boxWidth) {
        current += word;
        currentWidth += w;
      } else {
        flush();
        current = word;
        currentWidth = w;
      }
    }
    if (current !== "") flush();
  }
  return lines;
}

/** Total rendered height of a set of lines (lineHeight * line count). */
export function getTextBlockHeight(
  lines: TextLine[],
  props: Pick<TextElementProperties, "lineHeight" | "fontSize">,
): number {
  if (lines.length === 0) return 0;
  return lines.length * getLineHeight(props);
}

/** Longest line width — used as the auto box width. */
export function getTextBlockWidth(lines: TextLine[]): number {
  return lines.reduce((max, l) => Math.max(max, l.width), 0);
}

/**
 * Compute the display box size for a text element from content + resize mode —
 * the single source of truth for box geometry shared by the canvas renderer,
 * the SVG exporter, and the editing overlay (A11).
 *
 * - Auto width: measured longest line (min 20px).
 * - Auto height: line count × lineHeight (min fontSize × 1.4).
 * - Fixed box: keep the explicit width/height.
 */
export function getTextAutoBox(
  props: Pick<TextElementProperties, "width" | "height" | "fontFamily" | "fontSize" | "fontWeight" | "italic" | "letterSpacing" | "textCase" | "textAutoResize" | "lineHeight">,
  content: string,
): { width: number; height: number } {
  const isAutoWidth = props.width === "auto";
  const resize = props.textAutoResize ?? "NONE";
  const fixedWidth = typeof props.width === "number" ? props.width : 0;
  const wrapWidth = isAutoWidth || resize === "WIDTH_AND_HEIGHT" ? 0 : fixedWidth;
  const lines = getTextLines(content, props, wrapWidth);
  const width = isAutoWidth
    ? Math.max(getTextBlockWidth(lines), 20)
    : fixedWidth;
  const height = isAutoWidth
    ? Math.max(getTextBlockHeight(lines, props), props.fontSize * 1.4)
    : props.height;
  return { width, height };
}

export function computeAutoSize(
  props: Pick<TextElementProperties, "width" | "height" | "fontFamily" | "fontSize" | "fontWeight" | "italic" | "letterSpacing" | "textCase" | "lineHeight" | "textAutoResize">,
  content: string,
): { width?: number; height?: number } {
  const mode = props.textAutoResize ?? "NONE";
  if (mode === "NONE") return {};
  const boxWidth = props.width === "auto" ? 0 : props.width;
  const lines = getTextLines(content, props, boxWidth);
  const changes: { width?: number; height?: number } = {};
  if (mode === "WIDTH_AND_HEIGHT") {
    changes.width = Math.max(getTextBlockWidth(lines), 1);
  }
  changes.height = Math.max(getTextBlockHeight(lines, props), props.fontSize * 1.4);
  return changes;
}
