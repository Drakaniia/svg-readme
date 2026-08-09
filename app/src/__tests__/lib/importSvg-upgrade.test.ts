import { describe, it, expect } from "vitest";
import { parseSvgMarkup } from "../../lib/importSvg";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-3);
}

function firstShapeProps(result: { elementProperties: Record<string, ElementProperties> }) {
  const [id, props] = Object.entries(result.elementProperties)[0];
  expect(props.type).toBe("shape");
  return { id, props: props as Extract<ElementProperties, { type: "shape" }> };
}

describe("parseSvgMarkup — transforms", () => {
  it("bakes translate into rect geometry", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="100" height="50" transform="translate(5, 7)"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expect(props.x).toBe(15);
    expect(props.y).toBe(27);
  });

  it("bakes scale into rect geometry", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="100" height="50" transform="scale(2)"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expectClose(props.width, 200);
    expectClose(props.height, 100);
    expectClose(props.x, 20);
    expectClose(props.y, 40);
  });

  it("stores rotation about center as the shape rotation property", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="100" height="50" transform="rotate(30, 60, 45)"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expectClose(props.rotation ?? 0, 30);
    // Center must stay at (60, 45)
    expectClose(props.x + props.width / 2, 60);
    expectClose(props.y + props.height / 2, 45);
  });

  it("applies group transforms to children", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(100, 50)">
        <rect x="0" y="0" width="50" height="30"/>
      </g>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expect(props.x).toBe(100);
    expect(props.y).toBe(50);
  });

  it("applies nested group transforms cumulatively", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(10, 10)">
        <g transform="translate(20, 0)">
          <rect x="0" y="0" width="10" height="10"/>
        </g>
      </g>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expect(props.x).toBe(30);
    expect(props.y).toBe(10);
  });
});

describe("parseSvgMarkup — gradients", () => {
  it("maps fill url(#grad) to a GradientFill", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff0000"/>
          <stop offset="100%" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="10" height="10" fill="url(#g1)"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    const fill = props.fill as unknown as { type: string; stops: { offset: number; color: string }[] };
    expect(fill.type).toBe("linear");
    expect(fill.stops).toHaveLength(2);
    expect(fill.stops[0].color).toBe("#ff0000");
    expect(fill.stops[1].offset).toBeCloseTo(1, 5);
  });

  it("maps radial gradients", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g2" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="30" fill="url(#g2)"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    const fill = props.fill as unknown as { type: string };
    expect(fill.type).toBe("radial");
  });
});

describe("parseSvgMarkup — image", () => {
  it("parses image elements into image layers", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image x="10" y="20" width="100" height="60" href="data:image/png;base64,iVBORw0KGgo="/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].type).toBe("image");
    const props = result.elementProperties[result.layers[0].id];
    expect(props.type).toBe("image");
    if (props.type === "image") {
      expect(props.x).toBe(10);
      expect(props.y).toBe(20);
      expect(props.width).toBe(100);
      expect(props.url).toContain("data:image/png");
    }
  });
});

describe("parseSvgMarkup — use", () => {
  it("dereferences <use> to the referenced element", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <rect id="base" x="0" y="0" width="50" height="50" fill="#ff0000"/>
      </defs>
      <use href="#base" x="10" y="20"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    const props = result.elementProperties[result.layers[0].id];
    expect(props.type).toBe("shape");
    if (props.type === "shape") {
      expect(props.x).toBe(10);
      expect(props.y).toBe(20);
      expect(props.width).toBe(50);
    }
  });
});

describe("parseSvgMarkup — viewBox", () => {
  it("maps viewBox min-x/min-y to zero-based coordinates", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 200 500 300">
      <rect x="150" y="250" width="50" height="40"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    const { props } = firstShapeProps(result);
    expect(props.x).toBe(50);
    expect(props.y).toBe(50);
  });
});

describe("parseSvgMarkup — path curves", () => {
  it("converts C curves to editable bezier handles", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 C 10 20, 30 40, 50 60" fill="none" stroke="#000"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    const props = result.elementProperties[result.layers[0].id];
    expect(props.type).toBe("path");
    if (props.type === "path") {
      expect(props.points).toEqual([
        [0, 0],
        [50, 60],
      ]);
      expect(props.handles?.[0]?.out).toEqual([10, 20]);
      expect(props.handles?.[1]?.in).toEqual([30, 40]);
    }
  });

  it("parses multi-subpath paths into separate layers", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z" fill="#000"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(2);
  });
});

describe("parseSvgMarkup — group preservation", () => {
  it("preserves groups as group layers with children", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g>
        <rect x="0" y="0" width="10" height="10"/>
        <rect x="20" y="0" width="10" height="10"/>
      </g>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(3);
    const group = result.layers.find((l) => l.type === "group");
    expect(group).toBeDefined();
    const children = result.layers.filter((l) => l.parentId === group?.id);
    expect(children).toHaveLength(2);
  });
});
