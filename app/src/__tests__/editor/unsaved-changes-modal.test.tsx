import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnsavedChangesModal } from "../../components/ui/UnsavedChangesModal";

describe("UnsavedChangesModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onDiscard: vi.fn(),
    onSaveAndContinue: vi.fn(),
  };

  it("renders nothing when open is false", () => {
    render(<UnsavedChangesModal {...defaultProps} open={false} />);
    expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
  });

  it("renders the modal when open is true", () => {
    render(<UnsavedChangesModal {...defaultProps} />);
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
  });

  it("displays default description", () => {
    render(<UnsavedChangesModal {...defaultProps} />);
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
  });

  it("displays custom title and description", () => {
    render(
      <UnsavedChangesModal
        {...defaultProps}
        title="Custom Title"
        description="Custom description"
      />,
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<UnsavedChangesModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when Discard button is clicked", () => {
    const onDiscard = vi.fn();
    render(<UnsavedChangesModal {...defaultProps} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByText("Discard"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("calls onSaveAndContinue when Save & Continue button is clicked", () => {
    const onSaveAndContinue = vi.fn();
    render(
      <UnsavedChangesModal
        {...defaultProps}
        onSaveAndContinue={onSaveAndContinue}
      />,
    );
    fireEvent.click(screen.getByText("Save & Continue"));
    expect(onSaveAndContinue).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(<UnsavedChangesModal {...defaultProps} onClose={onClose} />);
    // Click the overlay (the backdrop div)
    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when modal card is clicked", () => {
    const onClose = vi.fn();
    render(<UnsavedChangesModal {...defaultProps} onClose={onClose} />);
    const card = screen.getByTestId("modal-card");
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<UnsavedChangesModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides Save & Continue when showSaveOption is false", () => {
    render(
      <UnsavedChangesModal
        {...defaultProps}
        showSaveOption={false}
      />,
    );
    expect(screen.queryByText("Save & Continue")).not.toBeInTheDocument();
  });

  it("shows Save & Continue by default", () => {
    render(<UnsavedChangesModal {...defaultProps} />);
    expect(screen.getByText("Save & Continue")).toBeInTheDocument();
  });
});
