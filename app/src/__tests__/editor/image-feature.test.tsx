import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import Canvas from "../../components/editor-canvas/Canvas";
import type { CanvasProps } from "../../components/editor-canvas/types";
import type { ImageElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import ElementsRenderer from "../../components/editor-canvas/ElementsRenderer";

const mockImageProps: ImageElementProperties = {
  type: "image",
  x: 100,
  y: 50,
  width: 200,
  height: 150,
  url: "data:image/png;base64,iVBORw0KGgo=",
  opacity: 1,
  rotation: 0,
};

const mockImagePropsRotated: ImageElementProperties = {
  ...mockImageProps,
  rotation: 30,
};

const defaultProps: CanvasProps = {
  frameSize: { width: 800, height: 600 },
  activeTool: "move",
  layers: [
    {
      id: "image-1",
      name: "Test Image",
      type: "image",
      locked: false,
      visible: true,
      active: true,
    },
  ],
  selectedLayerId: "image-1",
  selectedLayerIds: ["image-1"],
  isEditingText: false,
  elementProperties: {
    "image-1": mockImageProps,
  },
  onCreateText: vi.fn(),
  onCreateShape: vi.fn(),
  onSelectLayer: vi.fn(),
  onMoveElement: vi.fn(),
  onResizeStart: vi.fn(),
  onResizeElement: vi.fn(),
  onRotateStart: vi.fn(),
  onRotateElement: vi.fn(),
  onEditingChange: vi.fn(),
  onEditText: vi.fn(),
};

describe("Canvas — Image Feature", () => {
  it("renders an <image> element for image layers", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={defaultProps.elementProperties}
          selectedLayerIds={defaultProps.selectedLayerIds}
          onElementMouseDown={vi.fn()}
        />
      </svg>,
    );

    const imageEl = container.querySelector("image");
    expect(imageEl).not.toBeNull();
    expect(imageEl?.getAttribute("href")).toBe(mockImageProps.url);
    expect(imageEl?.getAttribute("x")).toBe("100");
    expect(imageEl?.getAttribute("y")).toBe("50");
    expect(imageEl?.getAttribute("width")).toBe("200");
    expect(imageEl?.getAttribute("height")).toBe("150");
  });

  it("applies data-layer-type='image' to the image element group", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={defaultProps.elementProperties}
          selectedLayerIds={defaultProps.selectedLayerIds}
          onElementMouseDown={vi.fn()}
        />
      </svg>,
    );

    const group = container.querySelector("[data-layer-type='image']");
    expect(group).not.toBeNull();
  });

  it("shows selection highlight when selected", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={defaultProps.elementProperties}
          selectedLayerIds={["image-1"]}
          onElementMouseDown={vi.fn()}
        />
      </svg>,
    );

    const group = container.querySelector("[data-layer-type='image']");
    // Should have: <image>, transparent hit rect, and selection rect = 3 elements
    const rects = group?.querySelectorAll("rect");
    expect(rects?.length).toBe(2); // hit area + selection
  });

  it("does NOT show selection highlight when not selected", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={defaultProps.elementProperties}
          selectedLayerIds={[]}
          onElementMouseDown={vi.fn()}
        />
      </svg>,
    );

    const group = container.querySelector("[data-layer-type='image']");
    const rects = group?.querySelectorAll("rect");
    // Only transparent hit area, no selection highlight
    expect(rects?.length).toBe(1);
  });

  it("applies rotation transform to the image element group", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={defaultProps.layers}
          elementProperties={{
            "image-1": mockImagePropsRotated,
          }}
          selectedLayerIds={defaultProps.selectedLayerIds}
          onElementMouseDown={vi.fn()}
        />
      </svg>,
    );

    const group = container.querySelector("[data-layer-type='image']");
    expect(group).not.toBeNull();
    // Center: x + w/2 = 200, y + h/2 = 125. Rotation: 30.
    expect(group?.getAttribute("transform")).toBe("rotate(30, 200, 125)");
  });

  it("renders resize handles for image layers in Canvas", () => {
    const { container } = render(<Canvas {...defaultProps} />);

    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).not.toBeNull();

    // Should have 8 handle groups
    const handleGroups = overlay?.querySelectorAll(".resize-handle-group");
    expect(handleGroups?.length).toBe(8);
  });

  it("renders rotate handle for image layers in Canvas", () => {
    const { container } = render(<Canvas {...defaultProps} />);

    const overlay = container.querySelector(".resize-overlay");
    expect(overlay).not.toBeNull();

    // Should have circles for rotate handle (visual + hit area)
    const circles = overlay?.querySelectorAll("circle");
    expect(circles?.length).toBe(2);
  });
});
