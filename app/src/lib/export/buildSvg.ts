import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import { ANIMATION_PRESETS, buildAnimationCSS } from "../../components/editor-canvas/ElementsRenderer";
import { isGradient, gradientId, buildGradientDef } from "../editor/gradient";
import { TEXT_ANCHOR_MAP, getTextVerticalOffset, getTextXWithinBox } from "../editor/textAlign";
import { getTextLines, getLineHeight, getTextBlockHeight, getTextBlockWidth } from "../editor/textMeasure";
import type { LayerType } from "../../context/EditorContext";
import { escXml, renderShapeToSvgString, renderImageToSvgString, renderPathToSvgString, trianglePath, starPath, hexagonPath } from "./shapes";
import { pointsToSvgD } from "../editor/pathUtils";

// ─── Build SVG string ────────────────────────────────────────────────────────

export interface BuildSvgOptions {
  frameSize: { width: number; height: number };
  elementProperties: Record<string, ElementProperties>;
  layers: LayerType[];
  /** Background color for the canvas (default: #09090b) */
  backgroundColor?: string;
  /** Whether to include rounded corners (default: true) */
  rounded?: boolean;
  /** Border radius in px (default: 12) */
  borderRadius?: number;
  /** Show border (default: true) */
  showBorder?: boolean;
}

export function buildSvgString(options: BuildSvgOptions): string {
  const {
    frameSize,
    elementProperties,
    layers,
    backgroundColor = "#09090b",
    rounded = true,
    borderRadius = 12,
    showBorder = true,
  } = options;

  const { width: w, height: h } = frameSize;

  // Build a lookup: parentId → children (sorted by layers order)
  const childrenMap = new Map<string | null, string[]>();
  for (const layer of layers) {
    const parentKey = layer.parentId ?? null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(layer.id);
  }

  // Also build a quick lookup by id
  const layerById = new Map(layers.map((l) => [l.id, l]));

  // Mask <clipPath> defs collected while rendering groups with a masked child.
  const maskDefs: string[] = [];

  /** Clip geometry string for a masked layer. */
  function maskClipShape(id: string): string {
    const props = elementProperties[id];
    if (!props) return "";
    if (props.type === "shape") {
      const { kind, x, y, width, height, cornerRadius } = props;
      if (kind === "rect") {
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${cornerRadius ?? 4}"/>`;
      }
      if (kind === "circle") {
        return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}"/>`;
      }
      if (kind === "triangle") return `<path d="${trianglePath(x, y, width, height)}"/>`;
      if (kind === "star") return `<path d="${starPath(x, y, width, height)}"/>`;
      if (kind === "hexagon") return `<path d="${hexagonPath(x, y, width, height)}"/>`;
      return ""; // lines have no area
    }
    if (props.type === "path") {
      return `<path d="${pointsToSvgD(props.points, props.closed, props.handles, props.subpaths)}"/>`;
    }
    if (props.type === "text") {
      return `<text x="${props.x}" y="${props.y + props.fontSize}" font-family="${props.fontFamily}" font-size="${props.fontSize}" font-weight="${props.fontWeight}">${escXml(props.content)}</text>`;
    }
    return ""; // image masks unsupported
  }

  /** Render a specific list of layer ids (used to split mask children). */
  function renderLayerList(ids: string[], indent: number): string[] {
    const result: string[] = [];
    const pad = "    ".repeat(indent);

    for (const id of ids) {
      const layer = layerById.get(id);
      if (!layer || !layer.visible) continue;

      if (layer.type === "group") {
        const kids = (childrenMap.get(id) ?? []).filter((kidId) => {
          const kl = layerById.get(kidId);
          return kl && kl.visible;
        });
        const maskKidId = kids.find((kidId) => layerById.get(kidId)?.masked);
        const rest = maskKidId ? kids.filter((k) => k !== maskKidId) : kids;
        if (maskKidId) {
          maskDefs.push(
            `${pad}<clipPath id="mask-${id}">${maskClipShape(maskKidId)}</clipPath>`,
          );
        }
        const content: string[] = [];
        if (maskKidId) {
          if (rest.length > 0) {
            content.push(`${pad}  <g clip-path="url(#mask-${id})">`);
            content.push(...renderLayerList(rest, indent + 2));
            content.push(`${pad}  </g>`);
          }
          // The mask layer itself renders normally (Figma shows its fill).
          content.push(...renderLayerList([maskKidId], indent + 1));
        } else {
          content.push(...renderLayerList(kids, indent + 1));
        }
        if (content.length > 0) {
          result.push(`${pad}<g id="${id}">`);
          result.push(...content);
          result.push(`${pad}</g>`);
        }
        continue;
      }

      const props = elementProperties[id];
      if (!props) continue;

      const anim = props.animation;

      if (props.type === "shape") {
        const shapeStr = renderShapeToSvgString(props, id);
        result.push(anim ? `    <g class="anim-${id}">\n${shapeStr}\n    </g>` : shapeStr);
      } else if (props.type === "image") {
        const imgStr = renderImageToSvgString(props);
        result.push(anim ? `    <g class="anim-${id}">\n${imgStr}\n    </g>` : imgStr);
      } else if (props.type === "path") {
        const pathStr = renderPathToSvgString(props);
        result.push(anim ? `    <g class="anim-${id}">\n${pathStr}\n    </g>` : pathStr);
      } else if (props.type === "text") {
        if (!props.content.trim()) continue;

        const anchor = TEXT_ANCHOR_MAP[props.textAlign] ?? "start";
        const fill = props.color;
        const family = props.fontFamily;
        const size = props.fontSize;
        const weight = props.fontWeight;
        const italicAttr = props.italic ? ` font-style="italic"` : "";
        const spacingAttr = props.letterSpacing ? ` letter-spacing="${props.letterSpacing}"` : "";

        // Box dimensions measured through textMeasure so the exported box agrees
        // with the rendered text (A11).
        const isAutoWidth = props.width === "auto";
        const fixedWidth = typeof props.width === "number" ? props.width : 0;
        const resize = props.textAutoResize ?? "NONE";
        const wrapWidth =
          isAutoWidth || resize === "WIDTH_AND_HEIGHT" ? 0 : fixedWidth;
        const lines = getTextLines(props.content, props, wrapWidth);
        const boxWidth: number = isAutoWidth
          ? Math.max(getTextBlockWidth(lines), 20)
          : fixedWidth;
        const boxHeight = props.height;
        const lineHeight = getLineHeight(props);
        const blockHeight = getTextBlockHeight(lines, props);
        const blockOffsetY = getTextVerticalOffset(boxHeight, blockHeight, props.textAlignVertical);

        const lineX =
          isAutoWidth || resize === "WIDTH_AND_HEIGHT"
            ? 0
            : getTextXWithinBox(props, boxWidth);
        const lineAnchor =
          isAutoWidth || resize === "WIDTH_AND_HEIGHT" ? "start" : anchor;

        const animClass = anim ? ` class="anim-${id}"` : "";
        result.push(`${pad}<g transform="translate(${props.x}, ${props.y})"${animClass}>`);

        if (props.backgroundColor) {
          result.push(
            `${pad}  <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" fill="${props.backgroundColor}" rx="3"/>`,
          );
        }

        lines.forEach((line, i) => {
          const lineY = blockOffsetY + size + i * lineHeight;
          const decoration = props.textDecoration ?? "NONE";
          const decorationY =
            decoration === "UNDERLINE"
              ? lineY + 2
              : lineY - size * 0.4;
          result.push(
            `${pad}  <text x="${lineX}" y="${lineY}" font-family="${family}" font-size="${size}" font-weight="${weight}"${italicAttr}${spacingAttr} fill="${fill}" text-anchor="${lineAnchor}">${escXml(line.text)}</text>`,
          );
          if (decoration !== "NONE" && line.text.length > 0) {
            const x1 =
              lineAnchor === "end"
                ? boxWidth - line.width
                : lineX;
            const x2 =
              lineAnchor === "end"
                ? boxWidth
                : lineAnchor === "middle"
                  ? lineX + line.width / 2
                  : lineX + line.width;
            result.push(
              `${pad}  <line x1="${x1}" y1="${decorationY}" x2="${x2}" y2="${decorationY}" stroke="${fill}" stroke-width="${Math.max(1, size * 0.06)}"/>`,
            );
          }
        });

        result.push(`${pad}</g>`);
      }
    }
    return result;
  }

  /** Recursively render a group of layers at a given parent level. */
  function renderChildren(parentId: string | null, indent: number): string[] {
    return renderLayerList(childrenMap.get(parentId) ?? [], indent);
  }

  const elementStrings = renderChildren(null, 2);

  // Collect gradient defs for layers using gradient fills.
  // Only shapes can carry a gradient fill (matches ElementsRenderer); isGradient
  // narrows the string-typed fill to GradientFill.
  const gradientDefs: string[] = [];
  for (const [id, props] of Object.entries(elementProperties)) {
    if (props.type === "shape" && isGradient(props.fill)) {
      gradientDefs.push(buildGradientDef(gradientId(id), props.fill));
    }
  }

  // Collect animation @keyframes CSS for all animated layers
  const animationKeyframesCSS: string[] = [];
  const animationRulesCSS: string[] = [];
  const seenAnimNames = new Set<string>();
  for (const layer of layers) {
    if (!layer.visible) continue;
    const props = elementProperties[layer.id];
    const anim = props?.animation;
    if (!anim) continue;
    // Collect unique keyframes (custom keyframes take priority over presets)
    if (!seenAnimNames.has(anim.name)) {
      seenAnimNames.add(anim.name);
      if (anim.customKeyframes) {
        // User-defined custom @keyframes block — use as-is
        animationKeyframesCSS.push(anim.customKeyframes);
      } else {
        // Look up the preset by name
        const preset = Object.entries(ANIMATION_PRESETS).find(
          ([, p]) => p.defaults.name === anim.name,
        );
        if (preset) {
          animationKeyframesCSS.push(preset[1].keyframesCSS);
        }
      }
    }
    // Build a CSS class rule for this specific layer
    const animCSS = buildAnimationCSS(anim);
    animationRulesCSS.push(`  .anim-${layer.id} { animation: ${animCSS}; }`);
  }

  // Accessibility: honor the user's reduced-motion preference. When the media
  // query matches, all animated layers render statically (A15).
  const reducedMotionCSS =
    animationRulesCSS.length > 0
      ? `\n  @media (prefers-reduced-motion: reduce) {\n    [class*="anim-"] { animation: none !important; }\n  }`
      : "";

  const rx = rounded ? ` rx="${borderRadius}"` : "";
  const borderStroke = showBorder
    ? ` stroke="rgba(255,255,255,0.10)" stroke-width="1"`
    : "";

  // Build combined <style> block
  const styleBlock = [
    `      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');`,
    ...animationKeyframesCSS.map((kf) => kf.split("\n").map((l) => `      ${l}`).join("\n")),
    ...animationRulesCSS.map((r) => `      ${r}`),
    reducedMotionCSS,
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
${styleBlock}
    </style>
${gradientDefs.join("\n")}
${maskDefs.join("\n")}
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="${backgroundColor}"${rx}${borderStroke}/>
${elementStrings.join("\n")}
</svg>`;
}
