import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProvider,
  MoveToolTestConsumer,
  resetLayerCounter,
} from "./fixtures";

// ═══════════════════════════════════════════════════════════════════════════════
//  EditorContext — Move Tool defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe("Move Tool — default state (Figma reference)", () => {
  beforeEach(() => resetLayerCounter());

  // Figma: Move Tool (V) is the default active tool
  it('defaults activeTool to "move"', () => {
    renderWithProvider(<MoveToolTestConsumer />);
    expect(screen.getByTestId("activeTool").textContent).toBe("move");
  });

  // Figma: Move Tool shows arrow cursor, not text cursor
  it("defaults isEditingText to false (no text cursor active)", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    expect(screen.getByTestId("isEditingText").textContent).toBe("false");
  });

  // Figma: No layer is selected initially
  it("defaults selectedLayerId to null (nothing selected)", () => {
    renderWithProvider(<MoveToolTestConsumer />);
    expect(screen.getByTestId("selectedLayerId").textContent).toBe("null");
  });

  it('defaults selectedLayerType to "none"', () => {
    renderWithProvider(<MoveToolTestConsumer />);
    expect(screen.getByTestId("selectedLayerType").textContent).toBe("none");
  });
});
