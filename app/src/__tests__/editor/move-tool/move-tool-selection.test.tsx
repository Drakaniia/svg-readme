import { describe, it, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import {
  renderWithProvider,
  MoveToolTestConsumer,
  resetLayerCounter,
} from "./fixtures";

// ═══════════════════════════════════════════════════════════════════════════════
//  Move Tool — Layer Selection (Figma reference)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Move Tool — layer selection (Figma reference)", () => {
  beforeEach(() => resetLayerCounter());

  // Figma: Single click on a layer selects the entire layer/component
  it("single-click on layer selects the layer (not the text content)", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    // Simulate clicking on the layer by selecting it (Move Tool behavior)
    act(() => screen.getByTestId("selectFirstLayer").click());
    // The layer should be selected
    expect(screen.getByTestId("selectedLayerId").textContent).not.toBe("null");
    // Text editing should NOT be active (layer selection ≠ text editing)
    expect(screen.getByTestId("isEditingText").textContent).toBe("false");
  });

  // Figma: Clicking empty canvas space deselects all
  it("click on empty canvas deselects all layers", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    act(() => screen.getByTestId("selectFirstLayer").click());
    expect(screen.getByTestId("selectedLayerId").textContent).not.toBe("null");
    // Click on empty canvas
    act(() => screen.getByTestId("clickEmptyCanvas").click());
    expect(screen.getByTestId("selectedLayerId").textContent).toBe("null");
  });

  // Figma: Only one layer is selected at a time with the Move Tool
  it("clicking on a different layer switches selection", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    // Add two layers at once
    act(() => screen.getByTestId("addTwoLayers").click());
    expect(screen.getByTestId("layersCount").textContent).toBe("2");

    // Select the first layer
    act(() => screen.getByTestId("selectFirstLayer").click());
    const firstId = screen.getByTestId("selectedLayerId").textContent;

    // Select the second layer (switches selection)
    act(() => screen.getByTestId("selectSecondLayer").click());
    const secondId = screen.getByTestId("selectedLayerId").textContent;

    // Two different layers should have different IDs
    expect(firstId).not.toBe(secondId);
    expect(firstId).not.toBe("null");
    expect(secondId).not.toBe("null");
  });

  // Figma: Selecting a layer by clicking in the canvas also selects in the layer panel
  it("selected layer type is 'text' for text layers", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    act(() => screen.getByTestId("addLayer").click());
    act(() => screen.getByTestId("selectFirstLayer").click());
    expect(screen.getByTestId("selectedLayerType").textContent).toBe("text");
  });
});
