// ─── Shortcut cheat-sheet (B5) ────────────────────────────────────────────────

export const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Tools",
    items: [
      ["V", "Move"],
      ["H", "Hand (pan)"],
      ["T", "Text"],
      ["P", "Pen"],
      ["R", "Rectangle"],
      ["O", "Circle"],
      ["L", "Line"],
    ],
  },
  {
    title: "Edit",
    items: [
      ["Ctrl+C", "Copy"],
      ["Ctrl+X", "Cut"],
      ["Ctrl+V", "Paste"],
      ["Ctrl+D", "Duplicate"],
      ["Delete", "Delete layer"],
      ["Ctrl+Z / Ctrl+Y", "Undo / Redo"],
      ["Ctrl+A / Ctrl+Shift+A", "Select all / Deselect"],
    ],
  },
  {
    title: "Arrange",
    items: [
      ["Ctrl+G / Ctrl+Shift+G", "Group / Ungroup"],
      ["Ctrl+[ / Ctrl+]", "Send back / Bring forward"],
      ["Arrow keys", "Nudge 1px"],
      ["Shift+Arrows", "Nudge 10px"],
      ["Shift+drag", "Constrain aspect / 15° rotate"],
      ["Alt+drag resize", "Resize from center"],
    ],
  },
  {
    title: "Canvas",
    items: [
      ["G", "Toggle grid"],
      ["0 / + / −", "Zoom 100% / In / Out"],
      ["Space / middle-click", "Pan"],
      ["Ctrl+E", "Export SVG"],
      ["Ctrl+/ or ?", "This shortcut list"],
    ],
  },
];

export function ShortcutGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="text-[10px] font-[JetBrains_Mono] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
            {group.title}
          </div>
          <div className="flex flex-col gap-1.5">
            {group.items.map(([key, label]) => (
              <div key={key + label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-400">{label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-300 whitespace-nowrap">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
