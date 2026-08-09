import { useRef, useCallback, useState, useEffect } from "react";
import type { AnimationConfig } from "../editor-canvas/ElementsRenderer";
import {
  timeToPixel,
  pixelToTime,
  generateTimeRulerTicks,
  ensureKeyframes,
} from "../../lib/editor/timelineUtils";

interface TimelineEditorProps {
  anim: AnimationConfig;
  elapsed: number;
  timelineWidth?: number;
  /** Called while actively dragging the playhead (for live preview with negative delay). */
  onScrubDrag?: (time: number) => void;
  /** Called when scrubbing ends (mouse up). */
  onScrubEnd?: () => void;
  /** Called when a keyframe is moved to a new percent. */
  onKeyframeMove?: (index: number, newPercent: number) => void;
}

const TRACK_HEIGHT = 48;
const RULER_HEIGHT = 14;
const TOTAL_HEIGHT = TRACK_HEIGHT + RULER_HEIGHT;
const KF_DIAMOND_SIZE = 8;
const PLAYHEAD_WIDTH = 1;
const HIT_RADIUS = 12;
const TRACK_PADDING_X = 4;

export default function TimelineEditor({
  anim,
  elapsed,
  timelineWidth = 260,
  onScrubDrag,
  onScrubEnd,
  onKeyframeMove,
}: TimelineEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"playhead" | number | null>(null);
  const keyframes = ensureKeyframes(anim);

  // Compute pixel positions
  const playheadPx = timeToPixel(elapsed, anim.duration, timelineWidth);
  const ticks = generateTimeRulerTicks(anim.duration, 8);

  const getSvgX = useCallback(
    (e: React.MouseEvent | MouseEvent): number => {
      const svg = svgRef.current;
      if (!svg) return 0;
      const rect = svg.getBoundingClientRect();
      return Math.max(0, Math.min(timelineWidth, e.clientX - rect.left));
    },
    [timelineWidth],
  );

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const px = getSvgX(e);
      const t = pixelToTime(px, anim.duration, timelineWidth);
      setDragging("playhead");
      onScrubDrag?.(t);
    },
    [getSvgX, anim.duration, timelineWidth, onScrubDrag],
  );

  const handleKeyframeMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      setDragging(index);
    },
    [],
  );

  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDragging("playhead");
    },
    [],
  );

  // Window-level mouse move/up for dragging
  useEffect(() => {
    if (dragging === null) return;

    const handleMove = (e: MouseEvent) => {
      const px = getSvgX(e);

      if (dragging === "playhead") {
        const t = pixelToTime(px, anim.duration, timelineWidth);
        onScrubDrag?.(t);
      } else if (typeof dragging === "number") {
        // Dragging a keyframe — compute new percent
        const t = pixelToTime(px, anim.duration, timelineWidth);
        const newPercent = Math.max(0, Math.min(100, Math.round((t / anim.duration) * 100)));
        onKeyframeMove?.(dragging, newPercent);
      }
    };

    const handleUp = () => {
      if (dragging === "playhead") {
        onScrubEnd?.();
      }
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, getSvgX, anim.duration, timelineWidth, onScrubDrag, onScrubEnd, onKeyframeMove]);

  return (
    <div className="flex flex-col gap-1">
      <svg
        ref={svgRef}
        width={timelineWidth + TRACK_PADDING_X * 2}
        height={TOTAL_HEIGHT}
        viewBox={`0 0 ${timelineWidth + TRACK_PADDING_X * 2} ${TOTAL_HEIGHT}`}
        className="cursor-pointer select-none"
        onMouseDown={handleTrackMouseDown}
      >
        {/* Track background */}
        <rect
          x={TRACK_PADDING_X}
          y={RULER_HEIGHT + 6}
          width={timelineWidth}
          height={TRACK_HEIGHT - 12}
          rx={3}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />

        {/* Ruler ticks */}
        {ticks.map((tick) => {
          const tx = TRACK_PADDING_X + timeToPixel(tick, anim.duration, timelineWidth);
          return (
            <g key={tick}>
              <line
                x1={tx}
                y1={2}
                x2={tx}
                y2={RULER_HEIGHT - 2}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={0.5}
              />
              <text
                x={tx}
                y={RULER_HEIGHT - 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.3)"
                fontSize={7}
                fontFamily="JetBrains Mono, monospace"
              >
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Keyframe diamonds */}
        {keyframes.map((kf, i) => {
          const kfPx = TRACK_PADDING_X + timeToPixel(
            (kf.percent / 100) * anim.duration,
            anim.duration,
            timelineWidth,
          );
          return (
            <g
              key={i}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleKeyframeMouseDown(e, i)}
            >
              {/* Hit area */}
              <rect
                x={kfPx - HIT_RADIUS}
                y={RULER_HEIGHT + 4}
                width={HIT_RADIUS * 2}
                height={TRACK_HEIGHT - 8}
                fill="transparent"
              />
              {/* Diamond shape */}
              <polygon
                points={`${kfPx},${RULER_HEIGHT + TRACK_HEIGHT / 2 - KF_DIAMOND_SIZE} ${kfPx + KF_DIAMOND_SIZE},${RULER_HEIGHT + TRACK_HEIGHT / 2} ${kfPx},${RULER_HEIGHT + TRACK_HEIGHT / 2 + KF_DIAMOND_SIZE} ${kfPx - KF_DIAMOND_SIZE},${RULER_HEIGHT + TRACK_HEIGHT / 2}`}
                fill={dragging === i ? "#fbbf24" : "#3b82f6"}
                stroke={dragging === i ? "#f59e0b" : "#2563eb"}
                strokeWidth={1}
              />
              {/* Percent label below */}
              <text
                x={kfPx}
                y={TOTAL_HEIGHT - 2}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize={7}
                fontFamily="JetBrains Mono, monospace"
              >
                {kf.percent}%
              </text>
            </g>
          );
        })}

        {/* Playhead */}
        <g
          className="cursor-ew-resize"
          onMouseDown={handlePlayheadMouseDown}
        >
          {/* Hit area */}
          <rect
            x={playheadPx + TRACK_PADDING_X - HIT_RADIUS}
            y={RULER_HEIGHT}
            width={HIT_RADIUS * 2}
            height={TRACK_HEIGHT}
            fill="transparent"
          />
          {/* Playhead line */}
          <line
            x1={playheadPx + TRACK_PADDING_X}
            y1={RULER_HEIGHT - 2}
            x2={playheadPx + TRACK_PADDING_X}
            y2={TOTAL_HEIGHT - 6}
            stroke={dragging === "playhead" ? "#fbbf24" : "#ef4444"}
            strokeWidth={PLAYHEAD_WIDTH + (dragging === "playhead" ? 1 : 0)}
          />
          {/* Playhead triangle handle */}
          <polygon
            points={`${playheadPx + TRACK_PADDING_X - 5},${RULER_HEIGHT - 2} ${playheadPx + TRACK_PADDING_X + 5},${RULER_HEIGHT - 2} ${playheadPx + TRACK_PADDING_X},${RULER_HEIGHT + 2}`}
            fill={dragging === "playhead" ? "#fbbf24" : "#ef4444"}
          />
        </g>

        {/* Progress fill */}
        {elapsed > 0 && (
          <rect
            x={TRACK_PADDING_X}
            y={RULER_HEIGHT + 6}
            width={playheadPx}
            height={TRACK_HEIGHT - 12}
            rx={3}
            fill="rgba(59,130,246,0.08)"
          />
        )}
      </svg>

      {/* Time readout */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] text-zinc-500 font-mono">
          {elapsed.toFixed(2)}s
        </span>
        <span className="text-[9px] text-zinc-600 font-mono">
          / {anim.duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
