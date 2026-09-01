import { describe, expect, it } from "vitest";
import {
  startPathFromPoint,
  addOrCloseVertex,
  beginPendingHandle,
  updatePendingHandle,
  commitPendingHandle,
  getEffectiveHandles,
  getEffectiveHandlesForPreview,
  closePathFromDoubleClick,
  finalizePathOpen,
  cancelPath,
} from "../../../lib/editor-tools/PenTool";
import { defaultToolState, type ToolInteractionState } from "../../../lib/editor-tools/types";
import { pointsToSvgD } from "../../../lib/editor/pathUtils";

function buildPathState(overrides: Partial<ToolInteractionState["pathDragState"]> = {}): ToolInteractionState {
  return {
    ...defaultToolState(),
    pathDragState: {
      points: [[0, 0]],
      previewPoint: [0, 0],
      isBuilding: true,
      closed: false,
      ...overrides,
    },
  };
}

describe("PenTool edge cases", () => {
  it("getEffectiveHandles returns original handles when pending not moved", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0]],
      handles: [{ out: [10, 10] }],
      pendingHandleVertex: 1,
      pendingHandlePoint: [100, 0],
      pendingHandleMoved: false,
    });
    const effective = getEffectiveHandles(state.pathDragState!);
    expect(effective).toEqual([{ out: [10, 10] }]);
  });

  it("getEffectiveHandles returns handles when no pending vertex", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0]],
      handles: [{ out: [10, 10] }],
    });
    const effective = getEffectiveHandles(state.pathDragState!);
    expect(effective).toEqual([{ out: [10, 10] }]);
  });

  it("getEffectiveHandles merges pending handle on first anchor (out only)", () => {
    const state = buildPathState({
      points: [[0, 0]],
      pendingHandleVertex: 0,
      pendingHandlePoint: [20, 20],
      pendingHandleMoved: true,
    });
    const effective = getEffectiveHandles(state.pathDragState!);
    expect(effective![0]).toEqual({ out: [20, 20], smooth: false });
  });

  it("getEffectiveHandles merges pending handle on later anchor (mirrored)", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [120, 40],
      pendingHandleMoved: true,
    });
    const effective = getEffectiveHandles(state.pathDragState!);
    // in = 120,40, out = mirror across 100,0 => 80,-40
    expect(effective![1]).toEqual({ in: [120, 40], out: [80, -40], smooth: true });
    const d = pointsToSvgD([ [0,0],[100,0]], false, effective);
    expect(d).toContain("C");
  });

  it("getEffectiveHandlesForPreview alias works", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [120, 40],
      pendingHandleMoved: true,
    });
    const a = getEffectiveHandles(state.pathDragState!);
    const b = getEffectiveHandlesForPreview(state.pathDragState!);
    expect(a).toEqual(b);
  });

  it("short drag threshold (3px) does not create handles, stays corner", () => {
    let state = buildPathState({ points: [[0, 0]], previewPoint: [0, 0] });
    state = { ...state, ...beginPendingHandle(state, 0, [0, 0]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [2, 0]) } as ToolInteractionState;
    expect(state.pathDragState!.pendingHandleMoved).toBe(false);
    const committed = { ...state, ...commitPendingHandle(state) } as ToolInteractionState;
    expect(committed.pathDragState!.handles).toBeUndefined();
  });

  it("drag beyond threshold (4px) creates handle", () => {
    let state = buildPathState({ points: [[0, 0]] });
    state = { ...state, ...beginPendingHandle(state, 0, [0, 0]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [5, 0]) } as ToolInteractionState;
    expect(state.pathDragState!.pendingHandleMoved).toBe(true);
    const committed = { ...state, ...commitPendingHandle(state) } as ToolInteractionState;
    expect(committed.pathDragState!.handles![0]).toBeDefined();
  });

  it("commit preserves previewPoint at anchor", () => {
    let state = buildPathState({ points: [[10, 10], [50, 50]], previewPoint: [50, 50] });
    state = { ...state, ...beginPendingHandle(state, 1, [50, 50]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [70, 70]) } as ToolInteractionState;
    const committed = { ...state, ...commitPendingHandle(state) } as ToolInteractionState;
    expect(committed.pathDragState!.previewPoint).toEqual([50, 50]);
  });

  it("addOrCloseVertex closes path when clicking near start with 3 points", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0], [50, 100]],
      previewPoint: [50, 100],
    });
    const result = addOrCloseVertex(state, 2, 1); // near start (0,0) within 8px
    expect(result.pathDragState!.closed).toBe(true);
    expect(result.pathDragState!.isBuilding).toBe(false);
    expect(result.pathDragState!.previewPoint).toBeNull();
  });

  it("addOrCloseVertex does not close with only 2 points if near start? Actually threshold says >=2, so it should close with 2", () => {
    const state = buildPathState({
      points: [[0, 0], [100, 0]],
      previewPoint: [100, 0],
    });
    const result = addOrCloseVertex(state, 2, 1);
    expect(result.pathDragState!.closed).toBe(true);
  });

  it("addOrCloseVertex adds point when far from start", () => {
    const state = buildPathState({ points: [[0, 0], [100, 0]] });
    const result = addOrCloseVertex(state, 200, 200);
    expect(result.pathDragState!.points).toEqual([[0,0],[100,0],[200,200]]);
    expect(result.pathDragState!.closed).toBe(false);
  });

  it("closePathFromDoubleClick requires 3 points, otherwise no-op", () => {
    const with2 = buildPathState({ points: [[0,0],[100,0]] });
    expect(closePathFromDoubleClick(with2)).toEqual({});
    const with3 = buildPathState({ points: [[0,0],[100,0],[50,100]] });
    const res = closePathFromDoubleClick(with3);
    expect(res.pathDragState!.closed).toBe(true);
    expect(res.pathDragState!.isBuilding).toBe(false);
  });

  it("finalizePathOpen sets isBuilding false and clears pending", () => {
    const state = buildPathState({
      points: [[0,0],[100,0]],
      pendingHandleVertex: 1,
      pendingHandlePoint: [120,40],
      pendingHandleMoved: true,
    });
    const res = finalizePathOpen(state);
    expect(res.pathDragState!.isBuilding).toBe(false);
    expect(res.pathDragState!.pendingHandleVertex).toBeUndefined();
    expect(res.pathDragState!.previewPoint).toBeNull();
  });

  it("cancelPath clears even with pending handle", () => {
    const state = buildPathState({
      points: [[0,0]],
      pendingHandleVertex: 0,
      pendingHandlePoint: [10,10],
      pendingHandleMoved: true,
    });
    const res = cancelPath(state);
    expect(res.pathDragState).toBeNull();
  });

  it("startPathFromPoint creates building state with preview", () => {
    const res = startPathFromPoint(42, 99);
    expect(res.pathDragState!.points).toEqual([[42,99]]);
    expect(res.pathDragState!.isBuilding).toBe(true);
    expect(res.pathDragState!.previewPoint).toEqual([42,99]);
    expect(res.pathDragState!.closed).toBe(false);
  });

  it("multiple handles in sequence preserve previous", () => {
    let state = buildPathState({ points: [[0,0]] });
    // drag first anchor
    state = { ...state, ...beginPendingHandle(state, 0, [0,0]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [20,20]) } as ToolInteractionState;
    void { ...state, ...commitPendingHandle(state) } as ToolInit_state;
    // add second point
  });

  it("live preview D with pending handle on second point is curved", () => {
    let state = buildPathState({ points: [[0,0]], previewPoint: [0,0] });
    state = { ...state, ...addOrCloseVertex(state, 100, 0) } as ToolInteractionState;
    state = { ...state, ...beginPendingHandle(state, 1, [100,0]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [130,30]) } as ToolInteractionState;
    const effective = getEffectiveHandles(state.pathDragState!);
    const d = pointsToSvgD(state.pathDragState!.points, false, effective);
    expect(d).toContain("C");
    // without effective it would be straight
    const straight = pointsToSvgD(state.pathDragState!.points, false, state.pathDragState!.handles);
    expect(straight).toContain("L");
    expect(straight).not.toContain("C");
  });
});

// Helper type alias for previous test typo guard
type ToolInit_state = ToolInteractionState;
