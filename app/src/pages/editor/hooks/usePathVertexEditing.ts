import { useEffect, useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ElementProperties } from "../../../components/editor-canvas/ElementsRenderer";
import { computePathBounds } from "../../../components/editor-canvas/ElementsRenderer";
import {
  splitSegment,
  deleteVertex,
  toggleVertexSmooth,
  shiftVertexHandles,
  mirrorPoint,
  translatePoints,
} from "../../../lib/editor/pathUtils";
import type { PathVertexHandle } from "../../../lib/editor/pathUtils";

interface UsePathVertexEditingParams {
  saveToHistory: () => void;
  setElementProperties: Dispatch<SetStateAction<Record<string, ElementProperties>>>;
}

export function usePathVertexEditing({
  saveToHistory,
  setElementProperties,
}: UsePathVertexEditingParams) {
  const [selectedVertex, setSelectedVertex] = useState<{
    layerId: string;
    index: number;
  } | null>(null);

  // ── Path vertex editing: move a single vertex ────────────────────────
  useEffect(() => {
    const handleVertexMove = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        elementId: string; vertexIndex: number; x: number; y: number;
      };
      setElementProperties((prev) => {
        const props = prev[detail.elementId];
        if (!props || props.type !== "path") return prev;
        if (detail.vertexIndex < 0 || detail.vertexIndex >= props.points.length) return prev;
        const [ox, oy] = props.points[detail.vertexIndex];
        const dx = detail.x - ox;
        const dy = detail.y - oy;
        const newPoints = [...props.points] as [number, number][];
        newPoints[detail.vertexIndex] = [detail.x, detail.y];
        const handles = shiftVertexHandles(props.handles, detail.vertexIndex, dx, dy);
        const bounds = computePathBounds(newPoints);
        return {
          ...prev,
          [detail.elementId]: { ...props, points: newPoints, handles, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        };
      });
    };
    window.addEventListener("path-vertex-move", handleVertexMove);
    return () => window.removeEventListener("path-vertex-move", handleVertexMove);
  }, [setElementProperties]);

  useEffect(() => {
    const handleSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail as { layerId: string; vertexIndex: number };
      setSelectedVertex({ layerId: detail.layerId, index: detail.vertexIndex });
    };
    const handleDragStart = () => { saveToHistory(); };
    window.addEventListener("path-vertex-select", handleSelect);
    window.addEventListener("path-vertex-drag-start", handleDragStart);
    return () => {
      window.removeEventListener("path-vertex-select", handleSelect);
      window.removeEventListener("path-vertex-drag-start", handleDragStart);
    };
  }, [saveToHistory]);

  useEffect(() => {
    const handleHandleMove = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        elementId: string; vertexIndex: number; side: "in" | "out"; x: number; y: number;
      };
      setElementProperties((prev) => {
        const props = prev[detail.elementId];
        if (!props || props.type !== "path") return prev;
        const n = props.points.length;
        if (detail.vertexIndex < 0 || detail.vertexIndex >= n) return prev;
        const anchor = props.points[detail.vertexIndex];
        const handles = props.handles
          ? props.handles.map((h) => (h ? { ...h } : undefined))
          : (new Array(n).fill(undefined) as (PathVertexHandle | undefined)[]);
        const current = handles[detail.vertexIndex] ?? {};
        const nextHandle = { ...current };
        const point: [number, number] = [detail.x, detail.y];
        if (detail.side === "in") {
          nextHandle.in = point;
          if (nextHandle.smooth) nextHandle.out = mirrorPoint(point, anchor);
        } else {
          nextHandle.out = point;
          if (nextHandle.smooth) nextHandle.in = mirrorPoint(point, anchor);
        }
        handles[detail.vertexIndex] = nextHandle;
        return { ...prev, [detail.elementId]: { ...props, handles } };
      });
    };
    window.addEventListener("path-handle-move", handleHandleMove);
    return () => window.removeEventListener("path-handle-move", handleHandleMove);
  }, [setElementProperties]);

  useEffect(() => {
    const handleNodeAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail as { layerId: string; segmentIndex: number };
      saveToHistory();
      setSelectedVertex(null);
      setElementProperties((prev) => {
        const props = prev[detail.layerId];
        if (!props || props.type !== "path") return prev;
        const n = props.points.length;
        const maxSeg = props.closed ? n : n - 1;
        if (detail.segmentIndex < 0 || detail.segmentIndex >= maxSeg) return prev;
        const { points, handles } = splitSegment(props.points, props.handles, detail.segmentIndex, props.closed);
        const bounds = computePathBounds(points);
        return { ...prev, [detail.layerId]: { ...props, points, handles, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
      });
    };
    window.addEventListener("path-node-add", handleNodeAdd);
    return () => window.removeEventListener("path-node-add", handleNodeAdd);
  }, [saveToHistory, setElementProperties]);

  useEffect(() => {
    const handleConvert = (e: Event) => {
      const detail = (e as CustomEvent).detail as { layerId: string; vertexIndex: number };
      saveToHistory();
      setElementProperties((prev) => {
        const props = prev[detail.layerId];
        if (!props || props.type !== "path") return prev;
        const handles = toggleVertexSmooth(props.points, props.handles, detail.vertexIndex);
        return { ...prev, [detail.layerId]: { ...props, handles } };
      });
    };
    window.addEventListener("path-vertex-convert", handleConvert);
    return () => window.removeEventListener("path-vertex-convert", handleConvert);
  }, [saveToHistory, setElementProperties]);

  // ── Move element ──────────────────────────────────────────────────────
  const handleMoveStart = useCallback(() => { saveToHistory(); }, [saveToHistory]);

  const handleMoveElement = useCallback((id: string, x: number, y: number) => {
    setElementProperties((prev) => {
      const props = prev[id];
      if (!props) return prev;
      if (props.type === "path") {
        const { points, handles, bounds, subpaths } = translatePoints(
          props.points, x - props.x, y - props.y, props.handles, props.subpaths,
        );
        return { ...prev, [id]: { ...props, points, handles, subpaths, ...bounds } };
      }
      return { ...prev, [id]: { ...props, x, y } };
    });
  }, [setElementProperties]);

  // ── Delete path node ──────────────────────────────────────────────────
  const handleDeleteVertex = useCallback((layerId: string, vertexIndex: number) => {
    saveToHistory();
    setElementProperties((prev) => {
      const props = prev[layerId];
      if (!props || props.type !== "path") return prev;
      if (props.points.length <= 2) return prev;
      const { points, handles } = deleteVertex(props.points, props.handles, vertexIndex);
      const closed = props.closed && points.length >= 3;
      const bounds = computePathBounds(points);
      return { ...prev, [layerId]: { ...props, points, handles, closed, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
    });
    setSelectedVertex(null);
  }, [saveToHistory, setElementProperties]);

  return {
    selectedVertex,
    setSelectedVertex,
    handleMoveStart,
    handleMoveElement,
    handleDeleteVertex,
  };
}
