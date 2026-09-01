import { useRef, useEffect } from "react";
import { screenToWorld } from "../../../lib/editor/geometry";
import type { ElementProperties } from "../ElementsRenderer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCanvasVertexEditingParams {
  activeTool: string;
  viewport: { zoom: number; panX: number; panY: number };
  svgRef: React.RefObject<SVGSVGElement | null>;
  elementProperties: Record<string, ElementProperties>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages path vertex editing listeners: drag individual vertices,
 * drag bezier handles, and the global mousemove that dispatches events
 * to EditorInner for state updates.
 */
export function useCanvasVertexEditing({
  activeTool,
  viewport,
  svgRef,
  elementProperties,
}: UseCanvasVertexEditingParams) {
  const vertexDragRef = useRef<{
    elementId: string;
    vertexIndex: number;
    startX: number;
    startY: number;
    historySaved: boolean;
  } | null>(null);

  const handleDragRef = useRef<{
    elementId: string;
    vertexIndex: number;
    side: "in" | "out";
    historySaved: boolean;
  } | null>(null);

  const elementPropertiesRef = useRef(elementProperties);
  useEffect(() => { elementPropertiesRef.current = elementProperties; }, [elementProperties]);

  // ── Path vertex mousedown (move tool: drag individual vertices) ─────────
  useEffect(() => {
    const handler = (e: Event) => {
      if (activeTool !== "move") return;
      const detail = (e as CustomEvent).detail as { layerId: string; vertexIndex: number };
      const props = elementPropertiesRef.current[detail.layerId];
      if (!props || props.type !== "path") return;
      if (detail.vertexIndex < 0 || detail.vertexIndex >= props.points.length) return;
      const [vx, vy] = props.points[detail.vertexIndex];
      vertexDragRef.current = {
        elementId: detail.layerId,
        vertexIndex: detail.vertexIndex,
        startX: vx,
        startY: vy,
        historySaved: false,
      };
      window.dispatchEvent(
        new CustomEvent("path-vertex-select", {
          detail: { layerId: detail.layerId, vertexIndex: detail.vertexIndex },
        }),
      );
    };
    window.addEventListener("path-vertex-mousedown", handler);
    return () => window.removeEventListener("path-vertex-mousedown", handler);
  }, [activeTool]);

  // ── Path bezier-handle mousedown (move tool: drag control points) ───────
  useEffect(() => {
    const handler = (e: Event) => {
      if (activeTool !== "move") return;
      const detail = (e as CustomEvent).detail as {
        layerId: string; vertexIndex: number; side: "in" | "out";
      };
      const props = elementPropertiesRef.current[detail.layerId];
      if (!props || props.type !== "path") return;
      handleDragRef.current = {
        elementId: detail.layerId,
        vertexIndex: detail.vertexIndex,
        side: detail.side,
        historySaved: false,
      };
      window.dispatchEvent(
        new CustomEvent("path-vertex-select", {
          detail: { layerId: detail.layerId, vertexIndex: detail.vertexIndex },
        }),
      );
    };
    window.addEventListener("path-handle-mousedown", handler);
    return () => window.removeEventListener("path-handle-mousedown", handler);
  }, [activeTool]);

  // ── Global mousemove for vertex + handle drags (fires even outside SVG) ─
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const world = screenToWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        { ...viewport, panX: 0, panY: 0 },
      );

      if (vertexDragRef.current) {
        const vd = vertexDragRef.current;
        const props = elementPropertiesRef.current[vd.elementId];
        if (!props || props.type !== "path") return;
        if (!vd.historySaved) {
          vd.historySaved = true;
          window.dispatchEvent(
            new CustomEvent("path-vertex-drag-start", {
              detail: { elementId: vd.elementId },
            }),
          );
        }
        window.dispatchEvent(new CustomEvent("path-vertex-move", {
          detail: { elementId: vd.elementId, vertexIndex: vd.vertexIndex, x: world.x, y: world.y },
        }));
      }

      if (handleDragRef.current) {
        const hd = handleDragRef.current;
        const props = elementPropertiesRef.current[hd.elementId];
        if (!props || props.type !== "path") return;
        if (!hd.historySaved) {
          hd.historySaved = true;
          window.dispatchEvent(
            new CustomEvent("path-vertex-drag-start", {
              detail: { elementId: hd.elementId },
            }),
          );
        }
        window.dispatchEvent(new CustomEvent("path-handle-move", {
          detail: {
            elementId: hd.elementId,
            vertexIndex: hd.vertexIndex,
            side: hd.side,
            x: world.x,
            y: world.y,
          },
        }));
      }
    };

    const upHandler = () => {
      vertexDragRef.current = null;
      handleDragRef.current = null;
    };

    window.addEventListener("mousemove", handler);
    window.addEventListener("mouseup", upHandler);
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("mouseup", upHandler);
    };
  }, [viewport, svgRef]);
}
