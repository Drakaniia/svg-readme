import { describe, expect, it } from "vitest";
import {
  PenTool,
  startPathFromPoint,
  addOrCloseVertex,
  finalizePathOpen,
  cancelPath,
  beginPendingHandle,
  updatePendingHandle,
  commitPendingHandle,
  closePathFromDoubleClick,
} from "../../../lib/editor-tools/PenTool";
import { defaultToolState, type ToolInteractionState } from "../../../lib/editor-tools/types";

/** Build a minimal ToolEventContext for unit-testing the PenTool. */
function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    event: { clientX: 0, clientY: 0, shiftKey: false, button: 0 } as unknown as React.MouseEvent,
    worldPoint: { x: 100, y: 100 },
    screenPoint: { x: 100, y: 100 },
    selectedId: null,
    selectedLayerIds: [],
    selectedProps: null,
    elementProperties: {},
    isEditingText: false,
    viewport: { zoom: 1, panX: 0, panY: 0 },
    snapEnabled: false,
    gridSize: 10,
    shiftKey: false,
    ...overrides,
  };
}

/** PathDragState factory for building states quickly in tests. */
function buildPathState(overrides: Partial<ToolInteractionState["pathDragState"]> = {}): ToolInteractionState {
  return {
    ...defaultToolState(),
    pathDragState: {
      points: [[50, 60]],
      previewPoint: [50, 60],
      isBuilding: true,
      closed: false,
      ...overrides,
    },
  };
}

describe("PenTool (click-to-place)", () => {
  it("returns crosshair cursor", () => {
    expect(PenTool.getCursor?.(defaultToolState())).toBe("crosshair");
  });

  it("returns undefined from onCanvasMouseDown (handled by Canvas)", () => {
    const ctx = makeCtx({ worldPoint: { x: 50, y: 60 } });
    const result = PenTool.onCanvasMouseDown?.(ctx);
    expect(result).toBeUndefined();
  });

  it("returns undefined from onMouseUp (path stays active in click-to-place)", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60], [70, 80]],
        previewPoint: [100, 100],
        isBuilding: true,
        closed: false,
      },
    };
    const ctx = makeCtx();
    const result = PenTool.onMouseUp?.(ctx, state);
    expect(result).toBeUndefined();
  });

  it("updates preview point on mousemove when building", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60]],
        previewPoint: [50, 60],
        isBuilding: true,
        closed: false,
      },
    };
    const ctx = makeCtx({ worldPoint: { x: 120, y: 80 } });
    const result = PenTool.onMouseMove?.(ctx, state);
    expect(result).toBeDefined();
    expect(result!.pathDragState!.previewPoint).toEqual([120, 80]);
  });

  it("does nothing on mousemove when not building", () => {
    const state = defaultToolState();
    const ctx = makeCtx({ worldPoint: { x: 100, y: 100 } });
    const result = PenTool.onMouseMove?.(ctx, state);
    expect(result).toBeUndefined();
  });

  // ── startPathFromPoint ───────────────────────────────────────────────────
  it("startPathFromPoint creates first vertex with building flag", () => {
    const result = startPathFromPoint(50, 60);
    expect(result.pathDragState).toBeDefined();
    expect(result.pathDragState!.points).toEqual([[50, 60]]);
    expect(result.pathDragState!.isBuilding).toBe(true);
    expect(result.pathDragState!.closed).toBe(false);
  });

  // ── addOrCloseVertex ────────────────────────────────────────────────────
  it("addOrCloseVertex adds a new point", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60]],
        previewPoint: [50, 60],
        isBuilding: true,
        closed: false,
      },
    };
    const result = addOrCloseVertex(state, 80, 90);
    expect(result.pathDragState!.points).toEqual([[50, 60], [80, 90]]);
    expect(result.pathDragState!.isBuilding).toBe(true);
  });

  it("addOrCloseVertex closes path when clicking near start", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60], [100, 80], [80, 120]],
        previewPoint: [80, 120],
        isBuilding: true,
        closed: false,
      },
    };
    // Click within 8px of the start
    const result = addOrCloseVertex(state, 52, 62);
    expect(result.pathDragState!.closed).toBe(true);
    expect(result.pathDragState!.isBuilding).toBe(false);
    expect(result.pathDragState!.previewPoint).toBeNull();
  });

  it("addOrCloseVertex does not close with only 1 point", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60]],
        previewPoint: [50, 60],
        isBuilding: true,
        closed: false,
      },
    };
    // Click near start with only 1 point — doesn't close
    const result = addOrCloseVertex(state, 52, 62);
    expect(result.pathDragState!.closed).toBe(false);
    expect(result.pathDragState!.isBuilding).toBe(true);
  });

  // ── finalizePathOpen ────────────────────────────────────────────────────
  it("finalizePathOpen sets isBuilding to false", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60], [80, 90]],
        previewPoint: [100, 100],
        isBuilding: true,
        closed: false,
      },
    };
    const result = finalizePathOpen(state);
    expect(result.pathDragState!.isBuilding).toBe(false);
    expect(result.pathDragState!.previewPoint).toBeNull();
  });

  // ── cancelPath ──────────────────────────────────────────────────────────
  it("cancelPath clears pathDragState", () => {
    const state: ToolInteractionState = {
      ...defaultToolState(),
      pathDragState: {
        points: [[50, 60], [80, 90]],
        previewPoint: [100, 100],
        isBuilding: true,
        closed: false,
      },
    };
    const result = cancelPath(state);
    expect(result.pathDragState).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Bezier handle pull (B1 — click-drag places smooth handles)
// ═══════════════════════════════════════════════════════════════════════════════

describe("PenTool bezier handle pull", () => {
  it("beginPendingHandle arms the pull on the placed vertex", () => {
    const state = buildPathState({ points: [[50, 60], [80, 90]] });
    const result = beginPendingHandle(state, 1, [80, 90]);
    expect(result.pathDragState!.pendingHandleVertex).toBe(1);
    expect(result.pathDragState!.pendingHandlePoint).toEqual([80, 90]);
    expect(result.pathDragState!.pendingHandleMoved).toBe(false);
  });

  it("updatePendingHandle marks the pull as moved beyond the drag threshold", () => {
    const state = buildPathState({
      points: [[50, 60], [80, 90]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [80, 90],
      pendingHandleMoved: false,
    });
    // Drag far away from the anchor (80,90)
    const result = updatePendingHandle(state, [120, 140]);
    expect(result.pathDragState!.pendingHandleMoved).toBe(true);
    expect(result.pathDragState!.pendingHandlePoint).toEqual([120, 140]);
    expect(result.pathDragState!.previewPoint).toEqual([120, 140]);
  });

  it("a short pull stays a corner (moved stays false)", () => {
    const state = buildPathState({
      points: [[50, 60], [80, 90]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [80, 90],
      pendingHandleMoved: false,
    });
    const result = updatePendingHandle(state, [82, 90]);
    expect(result.pathDragState!.pendingHandleMoved).toBe(false);
  });

  it("commitPendingHandle on the first anchor creates an outgoing handle only", () => {
    const state = buildPathState({
      points: [[50, 60]],
      pendingHandleVertex: 0,
      pendingHandlePoint: [30, 20],
      pendingHandleMoved: true,
    });
    const result = commitPendingHandle(state);
    const ps = result.pathDragState!;
    expect(ps.pendingHandleVertex).toBeUndefined();
    expect(ps.handles![0]).toEqual({ out: [30, 20], smooth: false });
  });

  it("commitPendingHandle on a later anchor creates a smooth mirrored pair", () => {
    const state = buildPathState({
      points: [[50, 60], [80, 90]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [120, 140],
      pendingHandleMoved: true,
    });
    const result = commitPendingHandle(state);
    const ps = result.pathDragState!;
    expect(ps.pendingHandleVertex).toBeUndefined();
    // in = pull point, out = mirror across anchor (80,90)
    expect(ps.handles![1]).toEqual({
      in: [120, 140],
      out: [40, 40],
      smooth: true,
    });
    expect(ps.handles![0]).toBeUndefined();
  });

  it("commitPendingHandle without a drag leaves a corner (no handles)", () => {
    const state = buildPathState({
      points: [[50, 60], [80, 90]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [80, 90],
      pendingHandleMoved: false,
    });
    const result = commitPendingHandle(state);
    expect(result.pathDragState!.handles).toBeUndefined();
    expect(result.pathDragState!.pendingHandleVertex).toBeUndefined();
  });

  it("commitPendingHandle preserves previously committed handles", () => {
    const state = buildPathState({
      points: [[50, 60], [80, 90]],
      handles: [{ out: [20, 60] }],
      pendingHandleVertex: 1,
      pendingHandlePoint: [120, 140],
      pendingHandleMoved: true,
    });
    const result = commitPendingHandle(state);
    expect(result.pathDragState!.handles![0]).toEqual({ out: [20, 60] });
    expect(result.pathDragState!.handles![1]!.smooth).toBe(true);
  });

  it("updatePendingHandle without a pending pull only moves the preview", () => {
    const state = buildPathState({ points: [[50, 60]] });
    const result = updatePendingHandle(state, [100, 100]);
    expect(result.pathDragState!.previewPoint).toEqual([100, 100]);
    expect(result.pathDragState!.pendingHandleVertex).toBeUndefined();
  });

  it("closePathFromDoubleClick closes an open path with 3+ anchors", () => {
    const state = buildPathState({
      points: [[50, 60], [100, 80], [80, 120]],
      pendingHandleVertex: 2,
      pendingHandlePoint: [120, 140],
      pendingHandleMoved: true,
    });
    const result = closePathFromDoubleClick(state);
    expect(result.pathDragState!.closed).toBe(true);
    expect(result.pathDragState!.isBuilding).toBe(false);
    expect(result.pathDragState!.pendingHandleVertex).toBeUndefined();
  });

  it("closePathFromDoubleClick is a no-op with fewer than 3 anchors", () => {
    const state = buildPathState({ points: [[50, 60], [100, 80]] });
    const result = closePathFromDoubleClick(state);
    expect(result).toEqual({});
  });
});
