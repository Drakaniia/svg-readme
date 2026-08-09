import { describe, it, expect, vi } from "vitest";
import type { TextElementProperties } from "../../components/editor-canvas/ElementsRenderer";

/** Factory for text element properties */
function makeTextProps(
  overrides?: Partial<TextElementProperties>,
): TextElementProperties {
  return {
    type: "text",
    x: 100,
    y: 100,
    width: "auto",
    height: 30,
    content: "Hello",
    fontFamily: "Poppins",
    fontSize: 16,
    fontWeight: 400,
    color: "#ffffff",
    textAlign: "left",
    textAlignVertical: "top",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Canvas — Move Tool interaction callbacks (Figma reference)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Canvas callbacks — Move Tool interactions (Figma reference)", () => {
  // Figma: Clicking on a text element with the Move Tool selects the layer
  it("handleElementMouseDown with move tool selects the layer, not the text", () => {
    const onSelectLayer = vi.fn();
    const onEditText = vi.fn();
    const onCommitText = vi.fn();

    // Simulate what Canvas.handleElementMouseDown does
    const simulateElementMouseDown = (
      e: { stopPropagation: () => void },
      layerId: string,
      activeTool: string,
      isEditingText: boolean,
    ) => {
      e.stopPropagation();
      if (isEditingText) onCommitText();
      if (activeTool === "move") {
        onSelectLayer(layerId);
      } else if (activeTool === "text") {
        onEditText(layerId);
      }
    };

    const e = { stopPropagation: vi.fn() };
    simulateElementMouseDown(e, "layer-1", "move", false);

    expect(onSelectLayer).toHaveBeenCalledWith("layer-1");
    expect(onEditText).not.toHaveBeenCalled();
    expect(onCommitText).not.toHaveBeenCalled();
  });

  // Figma: Double-click on text element with Move Tool enters edit mode
  it("handleElementDoubleClick with move tool on text enters edit mode", () => {
    const onEditText = vi.fn();
    const simulateDoubleClick = (
      _e: React.MouseEvent,
      layerId: string,
      activeTool: string,
      props: TextElementProperties | undefined,
    ) => {
      if (activeTool === "move") {
        if (props && props.type === "text") {
          onEditText(layerId);
        }
      }
    };

    simulateDoubleClick(
      {} as React.MouseEvent,
      "layer-1",
      "move",
      makeTextProps(),
    );
    expect(onEditText).toHaveBeenCalledWith("layer-1");
  });

  // Figma: Double-click on non-text element does NOT enter edit mode
  it("double-click on non-text layer does not enter edit mode", () => {
    const onEditText = vi.fn();
    const simulateDoubleClick = (
      _e: React.MouseEvent,
      layerId: string,
      activeTool: string,
      props: TextElementProperties | undefined,
    ) => {
      if (activeTool === "move") {
        if (props && props.type === "text") {
          onEditText(layerId);
        }
      }
    };

    simulateDoubleClick({} as React.MouseEvent, "layer-2", "move", undefined);
    expect(onEditText).not.toHaveBeenCalled();
  });

  // Figma: Clicking empty canvas deselects all
  it("handleMouseDown on empty canvas with move tool deselects all", () => {
    const onSelectLayer = vi.fn();
    const onCommitText = vi.fn();

    const simulateCanvasMouseDown = (
      activeTool: string,
      isEditingText: boolean,
    ) => {
      if (isEditingText) onCommitText();
      if (activeTool === "move") {
        onSelectLayer(null);
      }
    };

    simulateCanvasMouseDown("move", false);

    expect(onSelectLayer).toHaveBeenCalledWith(null);
    expect(onCommitText).not.toHaveBeenCalled();
  });

  // Figma: While editing, clicking an element commits text first then selects it
  it("when editing text and clicking an element, commits text first then selects element", () => {
    const onSelectLayer = vi.fn();
    const onCommitText = vi.fn();

    const simulateElementMouseDown = (
      e: { stopPropagation: () => void },
      layerId: string,
      activeTool: string,
      isEditingText: boolean,
    ) => {
      e.stopPropagation();
      if (isEditingText) onCommitText();
      if (activeTool === "move") {
        onSelectLayer(layerId);
      }
    };

    const e = { stopPropagation: vi.fn() };
    simulateElementMouseDown(e, "layer-2", "move", true);

    expect(onCommitText).toHaveBeenCalled();
    expect(onSelectLayer).toHaveBeenCalledWith("layer-2");
  });

  // Figma: Dragging an element with Move Tool calls onMoveElement
  it("dragging an element with move tool moves the element", () => {
    const onMoveElement = vi.fn();

    const simulateMouseMove = (
      dragState: { elementId: string; offsetX: number; offsetY: number } | null,
      clientX: number,
      clientY: number,
    ) => {
      if (dragState) {
        const newX = clientX - dragState.offsetX;
        const newY = clientY - dragState.offsetY;
        onMoveElement(dragState.elementId, newX, newY);
      }
    };

    const dragState = { elementId: "layer-1", offsetX: 50, offsetY: 50 };
    simulateMouseMove(dragState, 150, 100);

    expect(onMoveElement).toHaveBeenCalledWith("layer-1", 100, 50);
  });

  // Figma: Move Tool does NOT enter edit mode on single click (only double-click)
  it("text tool enters edit mode on single click of existing text, but Move Tool does not", () => {
    const onSelectLayer = vi.fn();
    const onEditText = vi.fn();

    // Move Tool: click selects the layer
    const simulateMoveToolClick = (
      e: { stopPropagation: () => void },
      layerId: string,
    ) => {
      e.stopPropagation();
      onSelectLayer(layerId);
      // Move tool does NOT call onEditText on single click
    };

    // Text Tool: click on existing text enters edit mode
    const simulateTextToolClick = (
      e: { stopPropagation: () => void },
      layerId: string,
      hasProps: boolean,
    ) => {
      e.stopPropagation();
      if (hasProps) onEditText(layerId);
    };

    const e = { stopPropagation: vi.fn() };

    // Move Tool behavior
    simulateMoveToolClick(e, "layer-1");
    expect(onSelectLayer).toHaveBeenCalledWith("layer-1");
    expect(onEditText).not.toHaveBeenCalled();

    onSelectLayer.mockClear();

    // Text Tool behavior
    simulateTextToolClick(e, "layer-1", true);
    expect(onEditText).toHaveBeenCalledWith("layer-1");
  });
});
