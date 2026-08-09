import React from "react";

// ─── Alignment UI Components ─────────────────────────────────────────────────

function AlignBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center gap-1 p-2 rounded-md text-[9px] font-medium transition-all ${
        disabled
          ? "text-zinc-600 cursor-not-allowed opacity-40"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent hover:border-white/10"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// Simple SVG icons for alignment actions (16x16 viewBox)

function AlignLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <rect x="4" y="3" width="8" height="2" rx="0.5" />
      <rect x="4" y="7" width="6" height="2" rx="0.5" />
      <rect x="4" y="11" width="9" height="2" rx="0.5" />
    </svg>
  );
}

function AlignCenterHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="2" x2="8" y2="14" />
      <rect x="3" y="3" width="10" height="2" rx="0.5" />
      <rect x="5" y="7" width="6" height="2" rx="0.5" />
      <rect x="2" y="11" width="12" height="2" rx="0.5" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="4" y="3" width="8" height="2" rx="0.5" />
      <rect x="6" y="7" width="6" height="2" rx="0.5" />
      <rect x="3" y="11" width="9" height="2" rx="0.5" />
    </svg>
  );
}

function AlignTopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <rect x="3" y="4" width="2" height="8" rx="0.5" />
      <rect x="7" y="4" width="2" height="6" rx="0.5" />
      <rect x="11" y="4" width="2" height="9" rx="0.5" />
    </svg>
  );
}

function AlignMiddleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="8" x2="14" y2="8" />
      <rect x="3" y="3" width="2" height="10" rx="0.5" />
      <rect x="7" y="5" width="2" height="6" rx="0.5" />
      <rect x="11" y="2" width="2" height="12" rx="0.5" />
    </svg>
  );
}

function AlignBottomIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="3" y="4" width="2" height="8" rx="0.5" />
      <rect x="7" y="6" width="2" height="6" rx="0.5" />
      <rect x="11" y="3" width="2" height="9" rx="0.5" />
    </svg>
  );
}

function DistributeHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="2" height="10" rx="0.5" />
      <rect x="7" y="3" width="2" height="10" rx="0.5" />
      <rect x="12" y="3" width="2" height="10" rx="0.5" />
      <line x1="4" y1="8" x2="7" y2="8" strokeDasharray="1.5 1.5" />
      <line x1="9" y1="8" x2="12" y2="8" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function DistributeVIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="2" width="10" height="2" rx="0.5" />
      <rect x="3" y="7" width="10" height="2" rx="0.5" />
      <rect x="3" y="12" width="10" height="2" rx="0.5" />
      <line x1="8" y1="4" x2="8" y2="7" strokeDasharray="1.5 1.5" />
      <line x1="8" y1="9" x2="8" y2="12" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

export { AlignBtn, AlignLeftIcon, AlignCenterHIcon, AlignRightIcon, AlignTopIcon, AlignMiddleIcon, AlignBottomIcon, DistributeHIcon, DistributeVIcon };
