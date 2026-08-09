import { defaultToolState } from "../../../lib/editor-tools/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function mergeState(partial: Partial<ReturnType<typeof defaultToolState>>): Partial<ReturnType<typeof defaultToolState>> {
  return partial;
}

export function getHandleCursor(handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br"): string {
  if (handle === "tl" || handle === "br") return "nwse-resize";
  if (handle === "tr" || handle === "bl") return "nesw-resize";
  if (handle === "tc" || handle === "bc") return "ns-resize";
  if (handle === "ml" || handle === "mr") return "ew-resize";
  return "default";
}
