import { describe, expect, it } from "vitest";
import {
  addOrCloseVertex,
  beginPendingHandle,
  updatePendingHandle,
  commitPendingHandle,
  getEffectiveHandlesForPreview,
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

describe("PenTool bugs - user reported", () => {
  it("curve should be visible while dragging second point handle (live preview)", () => {
    // User clicks at (0,0) then clicks at (100,0) and drags handle to (120,50)
    // While dragging (before mouseup), the preview path A->B should already be curved,
    // not straight. Current DragPreviews uses only committed handles, so preview is straight.
    // After fix, effective handles should include pending handle and produce a C command.
    let state = buildPathState({ points: [[0, 0]], previewPoint: [0, 0] });
    // Start path already at 0,0, commit its handle if needed then add second point
    state = { ...state, ...addOrCloseVertex(state, 100, 0) } as ToolInteractionState;
    expect(state.pathDragState!.points).toEqual([[0, 0], [100, 0]]);
    // Begin handle drag on second vertex
    let withPending = { ...state, ...beginPendingHandle(state, 1, [100, 0]) } as ToolInteractionState;
    withPending = { ...withPending, ...updatePendingHandle(withPending, [120, 50]) } as ToolInteractionState;
    // At this point pendingHandleMoved should be true
    expect(withPending.pathDragState!.pendingHandleMoved).toBe(true);
    // The LIVE preview path d should be curved (contain 'C') if we merge pending handle.
    // Simulate what DragPreviews should do: merge pending into handles
    const pending = withPending.pathDragState!;
    // This is the bug: current code would render pointsToSvgD with old handles (undefined) -> "M 0 0 L 100 0" (straight)
    const straightD = pointsToSvgD(pending.points, pending.closed, pending.handles);
    expect(straightD).toContain("L"); // before fix, it's straight
    // After fix, we expect a helper to produce curved D:
    // Build effective handles as commit would (but without committing)
    // For index 1, in = [120,50], out = mirror across [100,0] => [80,-50]
    // So effective handles[1] = { in: [120,50], out: [80,-50] }
    // Then pointsToSvgD should contain C
    // We test the commit result does curve after mouseup
    const committed = { ...withPending, ...commitPendingHandle(withPending) } as ToolInteractionState;
    const curvedD = pointsToSvgD(committed.pathDragState!.points, committed.pathDragState!.closed, committed.pathDragState!.handles);
    expect(curvedD).toContain("C");
    // LIVE preview before commit should ALSO be curved using effective handles helper
    const effective = getEffectiveHandlesForPreview(pending);
    const liveD = pointsToSvgD(pending.points, pending.closed, effective as never);
    expect(liveD).toContain("C");
  });

  it("commitPendingHandle should reset previewPoint to anchor, not handle tip", () => {
    let state = buildPathState({ points: [[0, 0], [100, 0]], previewPoint: [100, 0] });
    state = { ...state, ...beginPendingHandle(state, 1, [100, 0]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [120, 50]) } as ToolInteractionState;
    // pendingHandlePoint is now [120,50], previewPoint also [120,50] due to updatePendingHandle bug
    expect(state.pathDragState!.previewPoint).toEqual([120, 50]);
    const committed = { ...state, ...commitPendingHandle(state) } as ToolInteractionState;
    // After commit, previewPoint should be at anchor [100,0] so rubber-band starts at anchor
    // Currently it stays at [120,50] -> bug
    expect(committed.pathDragState!.previewPoint).toEqual([100, 0]);
  });

  it("pending handle on first anchor should set out only and live preview for next segment", () => {
    let state = buildPathState({ points: [[50, 50]], previewPoint: [50, 50] });
    state = { ...state, ...beginPendingHandle(state, 0, [50, 50]) } as ToolInteractionState;
    state = { ...state, ...updatePendingHandle(state, [30, 30]) } as ToolInteractionState;
    const committed = { ...state, ...commitPendingHandle(state) } as ToolInteractionState;
    expect(committed.pathDragState!.handles![0]).toEqual({ out: [30, 30], smooth: false });
    // previewPoint after commit should be at anchor
    expect(committed.pathDragState!.previewPoint).toEqual([50, 50]);
  });

  it("Escape should cancel path when isBuilding (simulated via cancel)", () => {
    // This test verifies cancelPath clears state even when pending handle exists
    const state = buildPathState({ points: [[0,0],[100,0]], previewPoint: [120,50], pendingHandleVertex: 1, pendingHandlePoint: [120,50], pendingHandleMoved: true });
    // Simulate Escape: should clear pathDragState
    const result = cancelPath(state);
    expect(result.pathDragState).toBeNull();
  });
});
