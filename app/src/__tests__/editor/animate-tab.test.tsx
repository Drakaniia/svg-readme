import { describe, it, expect, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EditorProvider, useEditor } from "../../context/EditorContext";
import EditorRightBar from "../../components/ui/EditorRightBar";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";
import type { LayerType } from "../../context/EditorContext";

/** Factory for a minimal shape layer */
function makeLayer(id: string, name: string): LayerType {
  return {
    id,
    name,
    type: "shape",
    locked: false,
    visible: true,
    active: true,
  };
}

/** Factory for shape element properties */
function makeShapeProps(x: number): ElementProperties {
  return {
    type: "shape",
    kind: "rect",
    x,
    y: 50,
    width: 60,
    height: 40,
    fill: "#8b5cf6",
    stroke: "none",
    strokeWidth: 0,
    opacity: 1,
  };
}

/** Reads elementProperties out of the provider so tests can assert applied animations. */
function PropsProbe({
  onProps,
}: {
  onProps: (p: Record<string, ElementProperties>) => void;
}) {
  const { elementProperties } = useEditor();
  useEffect(() => {
    onProps(elementProperties);
  }, [elementProperties, onProps]);
  return null;
}

function renderEditor(initial: {
  layers: LayerType[];
  elementProperties: Record<string, ElementProperties>;
  selectedLayerIds: string[];
  selectedLayerId: string | null;
}) {
  let captured: Record<string, ElementProperties> = {};
  render(
    <EditorProvider initial={initial}>
      <EditorRightBar />
      <PropsProbe
        onProps={(p) => {
          captured = p;
        }}
      />
    </EditorProvider>,
  );
  return {
    getCaptured: () => captured,
    openAnimateTab: () =>
      fireEvent.click(screen.getByRole("button", { name: "Animate" })),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("AnimateTab — multi-selection (stagger + bulk apply)", () => {
  it("shows stagger and bulk-apply controls when multiple layers are selected", () => {
    const { openAnimateTab } = renderEditor({
      layers: [makeLayer("a", "A"), makeLayer("b", "B")],
      elementProperties: { a: makeShapeProps(10), b: makeShapeProps(100) },
      selectedLayerIds: ["a", "b"],
      selectedLayerId: "a",
    });

    openAnimateTab();

    // Previously this fell through to the "No Layer Selected" view, so the
    // stagger section was unreachable. Now it must render.
    expect(screen.getByText(/Stagger/)).toBeTruthy();
    expect(screen.getByText(/Apply Same to All/)).toBeTruthy();
    expect(screen.getByText("2 layers")).toBeTruthy();
    expect(screen.queryByText("No Layer Selected")).toBeFalsy();
  });

  it("applies staggered delays when a stagger preset is clicked", () => {
    const { getCaptured, openAnimateTab } = renderEditor({
      layers: [makeLayer("a", "A"), makeLayer("b", "B")],
      elementProperties: { a: makeShapeProps(10), b: makeShapeProps(100) },
      selectedLayerIds: ["a", "b"],
      selectedLayerId: "a",
    });

    openAnimateTab();

    const staggerSection = screen.getByText(/Stagger/).closest(".p-5")!;
    fireEvent.click(
      within(staggerSection).getByRole("button", { name: /Slide Up/ }),
    );

    const animA = getCaptured()["a"]?.animation;
    const animB = getCaptured()["b"]?.animation;
    expect(animA).toBeTruthy();
    expect(animB).toBeTruthy();
    expect(animA?.name).toBe("slideUp");
    expect(animA?.delay).toBe(0);
    expect(animB?.delay).toBe(0.15); // default stagger step
  });

  it("applies the same animation to all selected layers", () => {
    const { getCaptured, openAnimateTab } = renderEditor({
      layers: [makeLayer("a", "A"), makeLayer("b", "B")],
      elementProperties: { a: makeShapeProps(10), b: makeShapeProps(100) },
      selectedLayerIds: ["a", "b"],
      selectedLayerId: "a",
    });

    openAnimateTab();

    const bulkSection = screen.getByText(/Apply Same to All/).closest(".p-5")!;
    fireEvent.click(
      within(bulkSection).getByRole("button", { name: /Pulse/ }),
    );

    const animA = getCaptured()["a"]?.animation;
    const animB = getCaptured()["b"]?.animation;
    expect(animA).toBeTruthy();
    expect(animA?.name).toBe("pulse");
    expect(animB).toEqual(animA); // identical config on every layer
  });
});

describe("AnimateTab — single selection still works", () => {
  it("applies a preset to the single selected layer", () => {
    const { getCaptured, openAnimateTab } = renderEditor({
      layers: [makeLayer("a", "A")],
      elementProperties: { a: makeShapeProps(10) },
      selectedLayerIds: ["a"],
      selectedLayerId: "a",
    });

    openAnimateTab();

    fireEvent.click(screen.getByRole("button", { name: "Fade In" }));

    const anim = getCaptured()["a"]?.animation;
    expect(anim).toBeTruthy();
    expect(anim?.name).toBe("fadeIn");
  });

  it("shows the browse view with no selection", () => {
    renderEditor({
      layers: [makeLayer("a", "A")],
      elementProperties: { a: makeShapeProps(10) },
      selectedLayerIds: [],
      selectedLayerId: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Animate" }));
    expect(screen.getByText("No Layer Selected")).toBeTruthy();
  });
});
