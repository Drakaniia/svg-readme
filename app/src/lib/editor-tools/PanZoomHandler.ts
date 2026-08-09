import { clampZoom, zoomAtPoint } from "../editor/geometry";
import type { Viewport } from "../editor/geometry";
import type React from "react";

/**
 * Start a pan interaction.
 */
export function startPan(
  event: React.MouseEvent,
  viewport: Viewport,
): { panState: { startX: number; startY: number; initialPanX: number; initialPanY: number } } {
  return {
    panState: {
      startX: event.clientX,
      startY: event.clientY,
      initialPanX: viewport.panX,
      initialPanY: viewport.panY,
    },
  };
}

/**
 * Update pan position from mouse movement.
 */
export function updatePan(
  panState: { startX: number; startY: number; initialPanX: number; initialPanY: number },
  clientX: number,
  clientY: number,
  viewport: Viewport,
): Viewport {
  return {
    ...viewport,
    panX: panState.initialPanX + clientX - panState.startX,
    panY: panState.initialPanY + clientY - panState.startY,
  };
}

/**
 * Handle wheel zoom, returning the new viewport.
 */
export function handleZoom(
  event: React.WheelEvent<SVGSVGElement>,
  viewport: Viewport,
  svgElement: SVGSVGElement,
): Viewport | null {
  const rect = svgElement.getBoundingClientRect();
  if (!rect) return null;

  const pointer = {
    x: viewport.panX + event.clientX - rect.left,
    y: viewport.panY + event.clientY - rect.top,
  };
  const nextZoom = clampZoom(viewport.zoom * (event.deltaY < 0 ? 1.1 : 0.9));
  return zoomAtPoint(viewport, pointer, nextZoom);
}
