import { describe, it, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import {
  renderWithProvider,
  MoveToolTestConsumer,
  resetLayerCounter,
} from "./fixtures";

// ═══════════════════════════════════════════════════════════════════════════════
//  Move Tool — Text Edit Mode (Figma reference)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Move Tool — text edit mode (Figma reference)", () => {
  beforeEach(() => resetLayerCounter());

  // Figma: Double-clicking a text layer with Move Tool enters text edit mode
  it("double-click on text layer enters text edit mode", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    // Double-click (selects layer + enters edit mode)
    act(() => screen.getByTestId("doubleClickLayer").click());
    expect(screen.getByTestId("isEditingText").textContent).toBe("true");
    expect(screen.getByTestId("selectedLayerId").textContent).not.toBe("null");
  });

  // Figma: Single click on text layer — selects the layer, does NOT enter edit mode
  it("single-click on text layer does NOT enter text edit mode", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    act(() => screen.getByTestId("selectFirstLayer").click());
    // Text editing should remain false (just layer selection)
    expect(screen.getByTestId("isEditingText").textContent).toBe("false");
  });

  // Figma: Exiting text edit mode keeps the layer selected
  it("exiting text edit mode keeps the layer selected", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    // Enter edit mode (double-click behavior)
    act(() => screen.getByTestId("doubleClickLayer").click());
    expect(screen.getByTestId("isEditingText").textContent).toBe("true");
    const selectedId = screen.getByTestId("selectedLayerId").textContent;
    // Exit edit mode (Escape or clicking outside)
    act(() => screen.getByTestId("exitEditMode").click());
    expect(screen.getByTestId("isEditingText").textContent).toBe("false");
    // The layer should remain selected after exiting edit mode
    expect(screen.getByTestId("selectedLayerId").textContent).toBe(selectedId);
  });
});
