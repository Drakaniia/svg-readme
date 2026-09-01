import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  EditorProvider,
  type EditorState,
} from "../../context/EditorContext";
import { EditorInner } from "../../pages/editor/EditorInner";

// Mock the API module
vi.mock("../../lib/api", () => ({
  createLayer: vi.fn().mockResolvedValue({}),
  getLayers: vi.fn().mockResolvedValue([]),
  updateLayer: vi.fn().mockResolvedValue({}),
  deleteLayer: vi.fn().mockResolvedValue({}),
  reorderLayers: vi.fn().mockResolvedValue({}),
}));

// Mock persistence modules
vi.mock("../../lib/persistence", () => ({
  onSaveStatus: vi.fn(() => () => {}),
  saveDocument: vi.fn(),
  saveNewProject: vi.fn(),
  loadProject: vi.fn(),
  fetchProjectList: vi.fn().mockResolvedValue([]),
  removeProject: vi.fn(),
  flushAutosave: vi.fn(),
}));

function renderEditor(initial?: Partial<EditorState>) {
  return render(
    <MemoryRouter>
      <EditorProvider initial={{ isProjectActive: true, ...initial }}>
        <EditorInner />
      </EditorProvider>
    </MemoryRouter>,
  );
}

describe("Workspace hand tool panning", () => {
  it("shows grab cursor on workspace when hand tool is active", () => {
    renderEditor({ activeTool: "hand" });
    const workspace = screen.getByTestId("workspace-area");
    expect(workspace).toHaveStyle({ cursor: "grab" });
  });

  it("shows default cursor on workspace when non-hand tool is active", () => {
    renderEditor({ activeTool: "move" });
    const workspace = screen.getByTestId("workspace-area");
    expect(workspace.style.cursor).toBe("");
  });

  it("shows grabbing cursor during pan drag on workspace", () => {
    renderEditor({ activeTool: "hand" });
    const workspace = screen.getByTestId("workspace-area");

    fireEvent.mouseDown(workspace, { clientX: 100, clientY: 100 });
    expect(workspace).toHaveStyle({ cursor: "grabbing" });

    fireEvent.mouseUp(workspace);
    expect(workspace).toHaveStyle({ cursor: "grab" });
  });

  it("pans viewport when dragging with hand tool on workspace", () => {
    renderEditor({ activeTool: "hand" });
    const workspace = screen.getByTestId("workspace-area");

    fireEvent.mouseDown(workspace, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(workspace, { clientX: 150, clientY: 120 });
    fireEvent.mouseUp(workspace);

    // The Canvas renders a div with transform: translate(panX, panY)
    const svgContainer = document.querySelector(
      "[style*='translate']",
    ) as HTMLElement;
    expect(svgContainer).not.toBeNull();
    const style = svgContainer.style.transform;
    expect(style).toContain("translate(");
    expect(style).not.toBe("translate(0px, 0px)");
  });
});
