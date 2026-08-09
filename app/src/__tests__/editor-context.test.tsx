import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  EditorProvider,
  useEditor,
  type EditorState,
} from "../context/EditorContext";

// ─── Test helper ──────────────────────────────────────────────────────────────

function renderWithProvider(
  ui: React.ReactElement,
  initial?: Partial<EditorState>,
) {
  return render(<EditorProvider initial={initial}>{ui}</EditorProvider>);
}

// ─── Consumer component for testing context values ───────────────────────────

function TestConsumer() {
  const ctx = useEditor();
  return (
    <div>
      <span data-testid="activeTool">{ctx.activeTool}</span>
      <span data-testid="isEditingText">{String(ctx.isEditingText)}</span>
      <span data-testid="selectedLayerId">{ctx.selectedLayerId ?? "null"}</span>
      <span data-testid="layersCount">{ctx.layers.length}</span>
      <span data-testid="frameSize">{`${ctx.frameSize.width}x${ctx.frameSize.height}`}</span>
      <span data-testid="isProjectActive">{String(ctx.isProjectActive)}</span>
      <button
        data-testid="setActiveTool-move"
        onClick={() => ctx.setActiveTool("move")}
      >
        Set Move
      </button>
      <button
        data-testid="setActiveTool-text"
        onClick={() => ctx.setActiveTool("text")}
      >
        Set Text
      </button>
      <button
        data-testid="setIsEditingText-true"
        onClick={() => ctx.setIsEditingText(true)}
      >
        Edit True
      </button>
      <button
        data-testid="setIsEditingText-false"
        onClick={() => ctx.setIsEditingText(false)}
      >
        Edit False
      </button>
      <button
        data-testid="setSelectedLayerId"
        onClick={() => ctx.setSelectedLayerId("layer-1")}
      >
        Select Layer
      </button>
      <button
        data-testid="clearSelectedLayerId"
        onClick={() => ctx.setSelectedLayerId(null)}
      >
        Clear Selection
      </button>
      <button
        data-testid="setFrameSize"
        onClick={() => ctx.setFrameSize({ width: 1000, height: 300 })}
      >
        Resize
      </button>
      <button
        data-testid="addLayer"
        onClick={() =>
          ctx.setLayers((prev) => [
            ...prev,
            {
              id: "new-layer",
              name: "New Layer",
              type: "text",
              locked: false,
              visible: true,
            },
          ])
        }
      >
        Add Layer
      </button>
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EditorContext", () => {
  describe("default values", () => {
    it('defaults activeTool to "move"', () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("activeTool").textContent).toBe("move");
    });

    it("defaults isEditingText to false", () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("isEditingText").textContent).toBe("false");
    });

    it("defaults selectedLayerId to null", () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("selectedLayerId").textContent).toBe("null");
    });

    it("defaults layers to empty array", () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("layersCount").textContent).toBe("0");
    });

    it("defaults frameSize to 700x350", () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("frameSize").textContent).toBe("700x350");
    });

    it("defaults isProjectActive to false", () => {
      renderWithProvider(<TestConsumer />);
      expect(screen.getByTestId("isProjectActive").textContent).toBe("false");
    });
  });

  describe("setActiveTool", () => {
    it('switches to "move"', () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setActiveTool-move").click());
      expect(screen.getByTestId("activeTool").textContent).toBe("move");
    });

    it('switches to "text"', () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setActiveTool-text").click());
      expect(screen.getByTestId("activeTool").textContent).toBe("text");
    });
  });

  describe("setIsEditingText", () => {
    it("sets editing text to true", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setIsEditingText-true").click());
      expect(screen.getByTestId("isEditingText").textContent).toBe("true");
    });

    it("sets editing text to false", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setIsEditingText-true").click());
      act(() => screen.getByTestId("setIsEditingText-false").click());
      expect(screen.getByTestId("isEditingText").textContent).toBe("false");
    });
  });

  describe("setSelectedLayerId", () => {
    it("selects a layer by id", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setSelectedLayerId").click());
      expect(screen.getByTestId("selectedLayerId").textContent).toBe("layer-1");
    });

    it("clears selection when set to null", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setSelectedLayerId").click());
      act(() => screen.getByTestId("clearSelectedLayerId").click());
      expect(screen.getByTestId("selectedLayerId").textContent).toBe("null");
    });
  });

  describe("setFrameSize", () => {
    it("updates frame size", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("setFrameSize").click());
      expect(screen.getByTestId("frameSize").textContent).toBe("1000x300");
    });
  });

  describe("setLayers", () => {
    it("adds a layer to the list", () => {
      renderWithProvider(<TestConsumer />);
      act(() => screen.getByTestId("addLayer").click());
      expect(screen.getByTestId("layersCount").textContent).toBe("1");
    });
  });

  describe("with initial values", () => {
    it("accepts initial activeTool", () => {
      renderWithProvider(<TestConsumer />, { activeTool: "text" });
      expect(screen.getByTestId("activeTool").textContent).toBe("text");
    });

    it("accepts initial frameSize", () => {
      renderWithProvider(<TestConsumer />, {
        frameSize: { width: 500, height: 500 },
      });
      expect(screen.getByTestId("frameSize").textContent).toBe("500x500");
    });

    it("accepts initial layers", () => {
      const initialLayers = [
        {
          id: "l1",
          name: "Layer 1",
          type: "text" as const,
          locked: false,
          visible: true,
        },
      ];
      renderWithProvider(<TestConsumer />, { layers: initialLayers });
      expect(screen.getByTestId("layersCount").textContent).toBe("1");
    });

    it("accepts initial isProjectActive", () => {
      renderWithProvider(<TestConsumer />, { isProjectActive: true });
      expect(screen.getByTestId("isProjectActive").textContent).toBe("true");
    });
  });
});

describe("useEditor outside provider", () => {
  it("throws error when used outside EditorProvider", () => {
    // Suppress console.error for the expected error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useEditor must be used within an EditorProvider",
    );
    spy.mockRestore();
  });
});
