import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import LayerPanel from "../../../components/editor-sidebar/LayerPanel";
import type { LayerType } from "../../../context/EditorContext";

function makeLayer(overrides: Partial<LayerType> & { id: string }): LayerType {
  return {
    name: `Layer ${overrides.id}`,
    type: "shape",
    locked: false,
    visible: true,
    parentId: null,
    ...overrides,
  };
}

/**
 * Stateful harness: LayerPanel is a controlled component, so the parent must
 * actually apply setLayers updates for re-renders to reflect the new state.
 */
function renderPanel(initialLayers: LayerType[]) {
  let latest: LayerType[] = initialLayers;
  const setLayers = vi.fn((updater: unknown) => {
    latest = typeof updater === "function" ? (updater as (p: LayerType[]) => LayerType[])(latest) : (updater as LayerType[]);
    rerender(
      <LayerPanel
        layers={latest}
        setLayers={setLayers}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
  });
  const utils = render(
    <LayerPanel
      layers={initialLayers}
      setLayers={setLayers}
      onAdd={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
      onReorder={vi.fn()}
    />,
  );
  const { rerender } = utils;
  return { setLayers, latest: () => latest, ...utils };
}

/** Flatten the layers + children fixture: root text, a group with two children. */
function fixtureLayers(): LayerType[] {
  return [
    makeLayer({ id: "bg", name: "Background", type: "shape" }),
    makeLayer({ id: "group-1", name: "Logo", type: "group" }),
    makeLayer({ id: "child-1", name: "Circle", type: "shape", parentId: "group-1" }),
    makeLayer({ id: "child-2", name: "Star", type: "shape", parentId: "group-1" }),
    makeLayer({ id: "footer", name: "Footer Text", type: "text" }),
  ];
}

describe("LayerPanel — search/filter", () => {
  it("filters layers by name (case-insensitive)", () => {
    renderPanel(fixtureLayers());
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "star" } });
    expect(screen.getByText("Star")).toBeTruthy();
    expect(screen.queryByText("Background")).toBeNull();
    expect(screen.queryByText("Footer Text")).toBeNull();
  });

  it("clears the filter back to all layers", () => {
    renderPanel(fixtureLayers());
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "star" } });
    expect(screen.queryByText("Background")).toBeNull();
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Background")).toBeTruthy();
    expect(screen.getByText("Footer Text")).toBeTruthy();
  });
});

describe("LayerPanel — child count badge", () => {
  it("shows a child count badge on groups", () => {
    renderPanel(fixtureLayers());
    const logoRow = screen.getByText("Logo").closest("li");
    expect(logoRow).toBeTruthy();
    expect(within(logoRow!).getByText("2")).toBeTruthy();
  });

  it("does not show a badge on leaf layers", () => {
    renderPanel(fixtureLayers());
    const bgRow = screen.getByText("Background").closest("li");
    expect(bgRow).toBeTruthy();
    expect(within(bgRow!).queryByText(/\d/)).toBeNull();
  });
});

describe("LayerPanel — collapse-all / expand-all", () => {
  it("collapses all groups", () => {
    renderPanel(fixtureLayers());
    const btn = screen.getByTitle(/collapse all/i);
    fireEvent.click(btn);
    // Children of the group should be hidden
    expect(screen.queryByText("Circle")).toBeNull();
    expect(screen.queryByText("Star")).toBeNull();
    // Root layers remain
    expect(screen.getByText("Background")).toBeTruthy();
    expect(screen.getByText("Footer Text")).toBeTruthy();
  });

  it("expands all groups after collapsing", () => {
    renderPanel(fixtureLayers());
    fireEvent.click(screen.getByTitle(/collapse all/i));
    expect(screen.queryByText("Circle")).toBeNull();
    fireEvent.click(screen.getByTitle(/expand all/i));
    expect(screen.getByText("Circle")).toBeTruthy();
    expect(screen.getByText("Star")).toBeTruthy();
  });
});

describe("LayerPanel — show/hide all", () => {
  it("hides all layers", () => {
    const { latest } = renderPanel(fixtureLayers());
    fireEvent.click(screen.getByTitle(/hide all/i));
    expect(latest().every((l) => l.visible === false)).toBe(true);
  });

  it("shows all layers again", () => {
    const { latest } = renderPanel(fixtureLayers());
    fireEvent.click(screen.getByTitle(/hide all/i));
    fireEvent.click(screen.getByTitle(/show all/i));
    expect(latest().every((l) => l.visible === true)).toBe(true);
  });
});

describe("LayerPanel — lock all", () => {
  it("locks all layers", () => {
    const { latest } = renderPanel(fixtureLayers());
    fireEvent.click(screen.getByTitle("Lock all layers"));
    expect(latest().every((l) => l.locked === true)).toBe(true);
  });

  it("unlocks all layers", () => {
    const { latest } = renderPanel(fixtureLayers());
    fireEvent.click(screen.getByTitle("Lock all layers"));
    fireEvent.click(screen.getByTitle("Unlock all layers"));
    expect(latest().every((l) => l.locked === false)).toBe(true);
  });
});

describe("LayerPanel — auto-expand on hover", () => {
  it("expands a collapsed group when dragging over it", () => {
    const { latest } = renderPanel(
      fixtureLayers().map((l) =>
        l.id === "group-1" ? { ...l, collapsed: true } : l,
      ),
    );
    // Circle/Star hidden because group collapsed
    expect(screen.queryByText("Circle")).toBeNull();

    const logoRow = screen.getByText("Logo").closest("li")!;
    const dragData = {
      setData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: "move",
      dropEffect: "",
    };
    fireEvent.dragStart(screen.getByText("Background").closest("li")!, {
      dataTransfer: dragData,
    });
    // jsdom reports zero-height rects, so give the row a real box: 90px tall,
    // and hover at 45px → middle third → position "inside".
    logoRow.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 90,
        left: 0,
        right: 200,
        width: 200,
        height: 90,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.dragOver(logoRow, { clientY: 45, dataTransfer: dragData });

    const group = latest().find((l) => l.id === "group-1");
    expect(group?.collapsed).toBe(false);
  });
});
