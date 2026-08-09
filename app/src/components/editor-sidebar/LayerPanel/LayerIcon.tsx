import { Type, Square, Image, Frame, PenLine } from "lucide-react";

// ─── Layer type icon resolver ─────────────────────────────────────────────────

export function LayerIcon({ type, className = "w-3.5 h-3.5" }: { type: string; className?: string }) {
  switch (type) {
    case "text":
      return <Type className={`${className} text-emerald-400`} />;
    case "shape":
      return <Square className={`${className} text-purple-400`} />;
    case "image":
      return <Image className={`${className} text-amber-400`} />;
    case "group":
      return <Frame className={`${className} text-blue-400`} />;
    case "path":
      return <PenLine className={`${className} text-rose-400`} />;
    default:
      return <Square className={`${className} text-zinc-500`} />;
  }
}
