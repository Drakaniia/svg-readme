import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EditorProvider } from "../context/EditorContext";
import { EditorInner } from "../pages/editor/EditorInner";
import type { LayerType } from "../context/EditorContext";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("../lib/export", () => ({
  buildSvgString: vi.fn(() => "<svg>mocked-banner</svg>"),
  downloadSvg: vi.fn(),
  copySvgText: vi.fn(),
  copyMarkdown: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  createLayer: vi.fn(),
  getLayers: vi.fn().mockResolvedValue([]),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Export feature", () => {
  it("calls downloadSvg with current canvas state when Export SVG button is clicked", async () => {
    const { downloadSvg } = await import("../lib/export");

    const layers: LayerType[] = [
      {
        id: "text-1",
        name: "Hello",
        type: "text",
        locked: false,
        visible: true,
      },
    ];

    render(
      <MemoryRouter>
        <EditorProvider
          initial={{
            isProjectActive: true,
            layers,
            frameSize: { width: 800, height: 200 },
          }}
        >
          <EditorInner />
        </EditorProvider>
      </MemoryRouter>,
    );

    // Click "Export SVG" button in the top navigation bar
    fireEvent.click(screen.getByText("Export SVG"));

    // Verify downloadSvg was called with the SVG string and default filename
    expect(downloadSvg).toHaveBeenCalledWith(
      expect.stringContaining("<svg>mocked-banner</svg>"),
      "banner.svg",
    );
  });
});
