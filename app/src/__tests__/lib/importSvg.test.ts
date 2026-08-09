import { describe, expect, it } from "vitest";
import { parseSvgMarkup } from "../../lib/importSvg";

describe("parseSvgMarkup", () => {
  it("parses rect elements into shape layers", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="20" width="100" height="50" fill="#ff0000" stroke="#000" stroke-width="2"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].type).toBe("shape");
    expect(result.layers[0].name).toBe("Rectangle");
    const props = result.elementProperties[result.layers[0].id];
    expect(props).toBeDefined();
    if (props && props.type === "shape") {
      expect(props.kind).toBe("rect");
      expect(props.x).toBe(10);
      expect(props.y).toBe(20);
      expect(props.width).toBe(100);
      expect(props.height).toBe(50);
      expect(props.fill).toBe("#ff0000");
    }
  });

  it("parses circle elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="30" fill="#00ff00"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].name).toBe("Ellipse");
  });

  it("parses line elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="100" y2="100" stroke="#fff" stroke-width="2"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].name).toBe("Line");
  });

  it("parses polyline elements as paths", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <polyline points="10,10 50,10 50,50" stroke="#3b82f6" fill="none" stroke-width="2"/>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    const props = result.elementProperties[result.layers[0].id];
    expect(props).toBeDefined();
    if (props && props.type === "path") {
      expect(props.points).toHaveLength(3);
      expect(props.closed).toBe(false);
    }
  });

  it("parses text elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="30" font-size="16" font-family="Poppins" fill="#fff">Hello</text>
    </svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].type).toBe("text");
    const props = result.elementProperties[result.layers[0].id];
    if (props && props.type === "text") {
      expect(props.content).toBe("Hello");
      expect(props.fontSize).toBe(16);
    }
  });

  it("preserves groups as group layers with nested children", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <g>
        <rect x="0" y="0" width="50" height="50" fill="#ff0000"/>
        <circle cx="75" cy="25" r="25" fill="#00ff00"/>
      </g>
    </svg>`;
    const result = parseSvgMarkup(svg);
    // group + 2 children
    expect(result.layers).toHaveLength(3);
    const group = result.layers.find((l) => l.type === "group");
    expect(group).toBeDefined();
    expect(result.layers.filter((l) => l.parentId === group?.id)).toHaveLength(2);
  });

  it("handles empty SVG gracefully", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(0);
  });

  it("handles invalid SVG gracefully", () => {
    const svg = `not valid svg at all`;
    const result = parseSvgMarkup(svg);
    expect(result.layers).toHaveLength(0);
  });
});
