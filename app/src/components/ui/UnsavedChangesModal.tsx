import { useEffect, useCallback, useRef } from "react";

export interface UnsavedChangesModalProps {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSaveAndContinue?: () => void;
  title?: string;
  description?: string;
  showSaveOption?: boolean;
}

export function UnsavedChangesModal({
  open,
  onClose,
  onDiscard,
  onSaveAndContinue,
  title = "Unsaved Changes",
  description = "You have unsaved changes.",
  showSaveOption = true,
}: UnsavedChangesModalProps) {
  const discardRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Auto-focus the Discard button when the modal opens
  useEffect(() => {
    if (open) {
      // Small delay to let the modal render before focusing
      const timer = setTimeout(() => discardRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        data-testid="modal-card"
        className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-100 font-[Poppins]">
          {title}
        </h3>
        <p className="text-xs text-zinc-400 mt-1 mb-5">{description}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            ref={discardRef}
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 rounded-md transition-colors"
          >
            Discard
          </button>
          {showSaveOption && onSaveAndContinue && (
            <button
              onClick={onSaveAndContinue}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            >
              Save &amp; Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
