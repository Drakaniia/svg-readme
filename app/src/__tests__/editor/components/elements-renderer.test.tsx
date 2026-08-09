import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ElementsRenderer from "../../../components/editor-canvas/ElementsRenderer";
import type {
  TextElementProperties,
  LayerType,
} from "../../../context/EditorContext";

/** Factory for a minimal text layer */
function makeLayer(id: string, overrides?: Partial<LayerType>): LayerType {
  return {
    id,
    name: `Layer ${id}`,
    type: "text",
    locked: false,
    visible: true,
    active: false,
    ...overrides,
  };
}

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
//  ElementsRenderer — Rendering behavior (Figma reference)
// ═══════════════════════════════════════════════════════════════════════════════

describe("ElementsRenderer — selection highlights (Figma reference)", () => {
  // Figma: Selected layer shows a blue bounding box (stroke #3b82f6)
  it("renders blue selection rect when layer is selected", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId="layer-1"
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const selectionRect = container.querySelector("rect[stroke='#3b82f6']");
    expect(selectionRect).toBeTruthy();
  });

  // Figma: When the resize/rotate overlay draws the box, the per-element
  // outline is suppressed so only a single box shows (with handles)
  it("suppresses the selection rect when the overlay covers that layer", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId="layer-1"
          hideSelectionOutlineForId="layer-1"
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const selectionRect = container.querySelector("rect[stroke='#3b82f6']");
    expect(selectionRect).toBeFalsy();
  });

  // Only the matching layer loses its outline — other selected layers keep theirs
  it("keeps the selection rect for layers not covered by the overlay", () => {
    const layers = [makeLayer("layer-1"), makeLayer("layer-2")];
    const elementProps = { "layer-1": makeTextProps(), "layer-2": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId="layer-2"
          hideSelectionOutlineForId="layer-1"
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const selectionRect = container.querySelector("rect[stroke='#3b82f6']");
    expect(selectionRect).toBeTruthy();
  });

  // Figma: When editing text, the selection highlight is hidden
  it("hides selection rect when layer is being edited", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId="layer-1"
          editingLayerId="layer-1"
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const selectionRect = container.querySelector("rect[stroke='#3b82f6']");
    expect(selectionRect).toBeFalsy();
  });

  // Figma: The SVG text content is hidden while editing (TextOverlay handles display)
  it("hides SVG text content when editing", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps({ content: "Hello" }) };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId="layer-1"
          editingLayerId="layer-1"
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const textElement = container.querySelector("text");
    expect(textElement).toBeFalsy();
  });

  // Figma: The SVG text content is visible when not editing
  it("shows SVG text content when not editing", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps({ content: "Hello" }) };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const textElement = container.querySelector("text");
    expect(textElement).toBeTruthy();
    expect(textElement?.textContent).toBe("Hello");
  });

  // Figma: Invisible hit area exists (no cursor-pointer class override)
  it("renders transparent hit rect without cursor-pointer override", () => {
    const layers = [makeLayer("layer-1")];
    const elementProps = { "layer-1": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const hitRect = container.querySelector("rect[fill='transparent']");
    expect(hitRect).toBeTruthy();
    expect(hitRect?.getAttribute("class")).not.toBe("cursor-pointer");
  });

  // Figma: Only visible layers are rendered
  it("does not render hidden layers", () => {
    const layers = [makeLayer("layer-1", { visible: false })];
    const elementProps = { "layer-1": makeTextProps() };

    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={elementProps}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
          onElementDoubleClick={() => {}}
        />
      </svg>,
    );

    const textElement = container.querySelector("text");
    expect(textElement).toBeFalsy();
  });
});

describe("ElementsRenderer — masks & flips (A4/A6)", () => {
  const shapeLayer = (id: string, overrides?: Partial<LayerType>): LayerType => ({
    id,
    name: id,
    type: "shape",
    locked: false,
    visible: true,
    ...overrides,
  });

  const rectProps = (overrides?: Record<string, unknown>) => ({
    type: "shape" as const,
    kind: "rect" as const,
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fill: "#ff0000",
    stroke: "none",
    strokeWidth: 0,
    opacity: 1,
    ...overrides,
  });

  it("emits a clipPath def and clips group children to the mask (A4)", () => {
    const layers = [
      shapeLayer("g", { type: "group" }),
      shapeLayer("mask", { parentId: "g", masked: true }),
      shapeLayer("kid", { parentId: "g" }),
    ];
    const props = {
      mask: rectProps({ x: 20, y: 20, width: 60, height: 40 }),
      kid: rectProps({ x: 5, y: 5, width: 100, height: 50 }),
    };
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={props}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
        />
      </svg>,
    );

    const clipPath = container.querySelector("clipPath");
    expect(clipPath).toBeTruthy();
    expect(clipPath!.getAttribute("id")).toBe("mask-g");
    // The mask geometry (a 60×40 rect) is inside the clipPath
    expect(clipPath!.querySelector("rect")?.getAttribute("width")).toBe("60");
    // A child <g> clips to the mask
    const clipped = container.querySelector('g[clip-path="url(#mask-g)"]');
    expect(clipped).toBeTruthy();
  });

  it("keeps rendering the mask layer itself (Figma shows its fill) (A4)", () => {
    const layers = [
      shapeLayer("g", { type: "group" }),
      shapeLayer("mask", { parentId: "g", masked: true }),
      shapeLayer("kid", { parentId: "g" }),
    ];
    const props = {
      mask: rectProps({ x: 20, y: 20, width: 60, height: 40 }),
      kid: rectProps({ x: 5, y: 5, width: 100, height: 50 }),
    };
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={layers}
          elementProperties={props}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
        />
      </svg>,
    );
    // The masked layer's fill rect (60 wide) still renders in the tree
    const fillRects = container.querySelectorAll("rect[fill='#ff0000']");
    expect(fillRects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders centered flip transforms on shapes (A6)", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={[shapeLayer("s")]}
          elementProperties={{ s: rectProps({ flipH: true }) }}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
        />
      </svg>,
    );
    const g = container.querySelector("g[data-layer-type='shape']");
    expect(g?.getAttribute("transform")).toContain("translate(60, 35) scale(-1, 1) translate(-60, -35)");
  });

  it("renders centered flip transforms on images (A6)", () => {
    const { container } = render(
      <svg>
        <ElementsRenderer
          layers={[{ id: "img", name: "img", type: "image", locked: false, visible: true }]}
          elementProperties={{
            img: {
              type: "image",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              url: "data:image/png;base64,AAAA",
              opacity: 1,
              flipV: true,
            },
          }}
          selectedLayerId={null}
          editingLayerId={null}
          onElementMouseDown={() => {}}
        />
      </svg>,
    );
    const g = container.querySelector("g[data-layer-type='image']");
    expect(g?.getAttribute("transform")).toContain("translate(20, 10) scale(1, -1) translate(-20, -10)");
  });
});
