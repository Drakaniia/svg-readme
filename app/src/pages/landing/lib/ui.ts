/**
 * Shared class strings for the landing pages, so buttons and section chrome
 * stay identical everywhere. Spacing, type and motion follow the landing
 * design system (see the named text styles in src/index.css).
 */

const interactive =
  "focus-ring transition-[background-color,border-color,color,transform,opacity] duration-300 ease-brand active:scale-[0.98] no-underline";

/** Main call to action: 8px / 12px padding, Button-md text. */
export const btnPrimary = `inline-flex items-center justify-center gap-2 px-3 py-2 button-md bg-[#1b5def] text-white border border-[#1b5def] hover:bg-[#164ecb] hover:border-[#164ecb] ${interactive}`;

/** Secondary action on a light surface. */
export const btnSecondary = `inline-flex items-center justify-center gap-2 px-3 py-2 button-md bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-900 ${interactive}`;

/** Compact header button. */
export const btnNav = `inline-flex items-center justify-center gap-2 px-3 py-2 button-sm bg-zinc-900 text-white border border-zinc-900 hover:bg-zinc-700 hover:border-zinc-700 ${interactive}`;

/** Small label above a section heading. */
export const eyebrow = "inline-flex items-center gap-2 caption-3 uppercase tracking-wider text-[#1b5def]";

/** Page width container. */
export const container = "max-w-[1200px] mx-auto px-4 sm:px-6";
