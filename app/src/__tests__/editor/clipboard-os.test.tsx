import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EditorProvider } from "../../context/EditorContext";
import { EditorInner } from "../../pages/editor/EditorInner";
import type { LayerType } from "../../context/EditorContext";
import type { ElementProperties } from "../../components/editor-canvas/ElementsRenderer";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../lib/api", () => ({
  createLayer: vi.fn(),
  getLayers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/export", () => ({
  buildSvgString: vi.fn(() => "<svg><rect/></svg>"),
  downloadSvg: vi.fn(),
  copySvgText: vi.fn(),
  copyMarkdown: vi.fn(),
  copyImageToClipboard: vi.fn(),
}));

// jsdom has no ClipboardItem or navigator.clipboard — stub both.
class MockClipboardItem {
  types: string[];
  constructor(items: Record<string, Blob>) {
    this.types = Object.keys(items);
  }
}

const clipboardWrite = vi.fn().mockResolvedValue(undefined);
const clipboardRead = vi.fn();

function stubClipboard(readImpl?: () => Promise<unknown[]>) {
  clipboardRead.mockImplementation(readImpl ?? (async () => []));
  Object.defineProperty(navigator, "clipboard", {
    value: { write: clipboardWrite, read: clipboardRead },
    configurable: true,
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const layer: LayerType = {
  id: "l1",
  name: "Hello",
  type: "text",
  locked: false,
  visible: true,
};

const textProps: ElementProperties = {
  type: "text",
  x: 100,
  y: 100,
  width: "auto",
  height: 24,
  content: "Hello",
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  color: "#ffffff",
  textAlign: "left",
  textAlignVertical: "top",
} as ElementProperties;

function renderEditor() {
  return render(
    <MemoryRouter>
      <EditorProvider
        initial={{
          isProjectActive: true,
          layers: [layer],
          elementProperties: { l1: textProps },
          selectedLayerIds: ["l1"],
        }}
      >
        <EditorInner />
      </EditorProvider>
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OS clipboard copy/paste (A10)", () => {
  beforeEach(() => {
    clipboardWrite.mockClear();
    clipboardRead.mockClear();
    vi.stubGlobal("ClipboardItem", MockClipboardItem);
    stubClipboard();
  });

  it("Ctrl+C writes an SVG snapshot + JSON payload to the OS clipboard", async () => {
    const { container } = renderEditor();
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    await vi.waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
    const items = clipboardWrite.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toBeInstanceOf(MockClipboardItem);
    expect(items[0].types).toContain("text/plain");
    expect(items[0].types).toContain("application/x-svg-readme");
    expect(container).toBeDefined();
  });

  it("Ctrl+V pastes our JSON payload from the OS clipboard as new layers", async () => {
    const payload = JSON.stringify({
      layers: [layer],
      elementProperties: { l1: textProps },
    });
    stubClipboard(async () => [
      {
        types: ["application/x-svg-readme"],
        getType: async () =>
          new Blob([payload], { type: "application/json" }),
      },
    ]);

    const { container } = renderEditor();
    await act(async () => {
      fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    });

    // The pasted layer gets a fresh id (l1-duplicate-*) and renders on the canvas.
    await vi.waitFor(() =>
      expect(container.querySelector('[data-layer-id^="l1-duplicate-"]')).not.toBeNull(),
    );
  });

  it("Ctrl+V pastes raw SVG markup via parseSvgMarkup", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="1" y="2" width="30" height="20" fill="#ff0000"/></svg>';
    stubClipboard(async () => [
      {
        types: ["text/plain"],
        getType: async () => new Blob([svg], { type: "text/plain" }),
      },
    ]);

    const { container } = renderEditor();
    await act(async () => {
      fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    });

    await vi.waitFor(() =>
      expect(container.querySelector('[data-layer-id^="imported-"]')).not.toBeNull(),
    );
  });

  it("Ctrl+V pastes plain text as a new text layer", async () => {
    stubClipboard(async () => [
      {
        types: ["text/plain"],
        getType: async () => new Blob(["copied text"], { type: "text/plain" }),
      },
    ]);

    const { container } = renderEditor();
    await act(async () => {
      fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    });

    await vi.waitFor(() =>
      expect(container.querySelector('[data-layer-id^="text-"]')).not.toBeNull(),
    );
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-layer-id^="text-"] text')?.textContent,
      ).toBe("copied text"),
    );
  });

  it("falls back to the internal clipboard when the OS read is unavailable", async () => {
    // OS read throws (permissions) — internal clipboard from a prior copy wins.
    stubClipboard(async () => {
      throw new Error("NotAllowedError");
    });

    const { container } = renderEditor();
    // Populate the internal clipboard via Ctrl+C first.
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    await vi.waitFor(() => expect(clipboardWrite).toHaveBeenCalled());

    await act(async () => {
      fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    });
    await vi.waitFor(() =>
      expect(container.querySelector('[data-layer-id^="l1-duplicate-"]')).not.toBeNull(),
    );
  });
});
