import type { TextDragState, ShapeDragState, RubberBandState, PathDragState } from "./types";
import { pointsToSvgD, mirrorPoint } from "../../lib/editor/pathUtils";
import { getEffectiveHandles } from "../../lib/editor-tools/PenTool";
import { trianglePath, starPath, hexagonPath } from "./shapeHelpers";

interface DragPreviewsProps {
  rubberBandState: RubberBandState | null;
  textDragState: TextDragState | null;
  shapeDragState: ShapeDragState | null;
  pathDragState: PathDragState | null;
}

export default function DragPreviews({
  rubberBandState,
  textDragState,
  shapeDragState,
  pathDragState,
}: DragPreviewsProps) {
  return (
    <>
      {rubberBandState && (
        <rect
          x={Math.min(rubberBandState.startX, rubberBandState.currentX)}
          y={Math.min(rubberBandState.startY, rubberBandState.currentY)}
          width={Math.abs(rubberBandState.currentX - rubberBandState.startX)}
          height={Math.abs(rubberBandState.currentY - rubberBandState.startY)}
          fill="rgba(59,130,246,0.08)"
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="4 2"
          rx={1}
          className="pointer-events-none"
        />
      )}
      {textDragState && (
        <rect
          x={Math.min(textDragState.startX, textDragState.currentX)}
          y={Math.min(textDragState.startY, textDragState.currentY)}
          width={Math.abs(textDragState.currentX - textDragState.startX)}
          height={Math.abs(textDragState.currentY - textDragState.startY)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
      {shapeDragState && (() => {
        const { kind, startX, startY, currentX, currentY, shiftKey } = shapeDragState;
        const dx = currentX - startX;
        const dy = currentY - startY;
        let w = Math.max(Math.abs(dx), 1);
        let h = Math.max(Math.abs(dy), 1);
        let x = Math.min(startX, currentX);
        let y = Math.min(startY, currentY);

        // Shift constraint: 1:1 aspect ratio preview
        if (shiftKey && kind !== "line") {
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          w = side;
          h = side;
          x = dx >= 0 ? startX : startX - side;
          y = dy >= 0 ? startY : startY - side;
        }

        if (kind === "line") {
          return (
            <line
              x1={startX} y1={startY}
              x2={currentX} y2={currentY}
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          );
        }

        if (kind === "circle") {
          const rx = w / 2;
          const ry = h / 2;
          return (
            <ellipse
              cx={x + rx} cy={y + ry}
              rx={rx} ry={ry}
              fill="rgba(139,92,246,0.12)"
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          );
        }

        if (kind === "triangle") {
          return (
            <path
              d={trianglePath(x, y, w, h)}
              fill="rgba(139,92,246,0.12)"
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          );
        }

        if (kind === "star") {
          return (
            <path
              d={starPath(x, y, w, h)}
              fill="rgba(139,92,246,0.12)"
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          );
        }

        if (kind === "hexagon") {
          return (
            <path
              d={hexagonPath(x, y, w, h)}
              fill="rgba(139,92,246,0.12)"
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          );
        }

        return (
          <rect
            x={x} y={y}
            width={w} height={h}
            fill="rgba(139,92,246,0.12)"
            stroke="#8b5cf6"
            strokeWidth={1}
            strokeDasharray="4 2"
            rx={8}
            className="pointer-events-none"
          />
        );
      })()}
      {pathDragState && pathDragState.points.length > 0 && (() => {
        const effectiveHandles = pathDragState.isBuilding
          ? getEffectiveHandles(pathDragState)
          : pathDragState.handles;
        return (
        <g className="pointer-events-none">
          {/* Placed vertices and connecting segments (bezier when handles exist) */}
          {pathDragState.points.length >= 2 && (
            <path
              d={pointsToSvgD(pathDragState.points, pathDragState.closed, effectiveHandles)}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* Committed bezier handles of placed vertices */}
          {pathDragState.handles?.map((h, i) => {
            if (!h) return null;
            const [ax, ay] = pathDragState.points[i];
            return (
              <g key={`h-${i}`}>
                {h.in && (
                  <line x1={ax} y1={ay} x2={h.in[0]} y2={h.in[1]} stroke="#60a5fa" strokeWidth={1} />
                )}
                {h.out && (
                  <line x1={ax} y1={ay} x2={h.out[0]} y2={h.out[1]} stroke="#60a5fa" strokeWidth={1} />
                )}
                {h.in && <circle cx={h.in[0]} cy={h.in[1]} r={3} fill="white" stroke="#60a5fa" strokeWidth={1} />}
                {h.out && <circle cx={h.out[0]} cy={h.out[1]} r={3} fill="white" stroke="#60a5fa" strokeWidth={1} />}
              </g>
            );
          })}
          {/* Rubber-band preview line from last vertex to cursor */}
          {pathDragState.isBuilding &&
            pathDragState.previewPoint &&
            pathDragState.points.length >= 1 &&
            pathDragState.pendingHandleVertex == null && (
              <line
                x1={pathDragState.points[pathDragState.points.length - 1][0]}
                y1={pathDragState.points[pathDragState.points.length - 1][1]}
                x2={pathDragState.previewPoint[0]}
                y2={pathDragState.previewPoint[1]}
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.6}
              />
            )}
          {/* Pending bezier handle pull (click-drag placement) */}
          {pathDragState.pendingHandleVertex != null &&
            pathDragState.pendingHandlePoint && (() => {
              const i = pathDragState.pendingHandleVertex!;
              const [ax, ay] = pathDragState.points[i];
              const [hx, hy] = pathDragState.pendingHandlePoint!;
              const moved = !!pathDragState.pendingHandleMoved;
              const mirrored =
                moved && i > 0
                  ? mirrorPoint([hx, hy], [ax, ay])
                  : null;
              return (
                <g>
                  <line x1={ax} y1={ay} x2={hx} y2={hy} stroke="#60a5fa" strokeWidth={1.5} />
                  {mirrored && (
                    <line x1={ax} y1={ay} x2={mirrored[0]} y2={mirrored[1]} stroke="#60a5fa" strokeWidth={1} strokeDasharray="2 2" opacity={0.8} />
                  )}
                  <circle cx={hx} cy={hy} r={4} fill="white" stroke="#60a5fa" strokeWidth={1.5} />
                </g>
              );
            })()}
          {/* Vertex handles */}
          {pathDragState.points.map(([px, py], i) => (
            <g key={i}>
              {/* Larger hover target */}
              <circle cx={px} cy={py} r={8} fill="transparent" />
              {/* Vertex dot */}
              <circle
                cx={px}
                cy={py}
                r={i === 0 ? 5 : 4}
                fill="white"
                stroke={i === 0 ? "#22c55e" : "#3b82f6"}
                strokeWidth={2}
              />
            </g>
          ))}
          {/* Close-path indicator near start */}
          {pathDragState.isBuilding && pathDragState.points.length >= 2 && pathDragState.previewPoint && (
            <circle
              cx={pathDragState.points[0][0]}
              cy={pathDragState.points[0][1]}
              r={8}
              fill="rgba(34,197,94,0.15)"
              stroke="#22c55e"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}
        </g>
        );
      })()}
    </>
  );
}
