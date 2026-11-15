import { Link } from "react-router-dom";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, Export, FloppyDisk, PenNib, Stack, Sparkle } from "@phosphor-icons/react";
import Reveal from "./Reveal";
import { btnSecondary, container, eyebrow } from "../lib/ui";

const CAPABILITIES: { icon: Icon; title: string; body: string }[] = [
  {
    icon: PenNib,
    title: "Draw anything",
    body: "Pen paths with vertex editing, rectangles, circles, stars, hexagons, text, and images.",
  },
  {
    icon: Stack,
    title: "Layers and history",
    body: "Group, lock, reorder, and multi select layers, with undo, redo, snapping, and a grid.",
  },
  {
    icon: Sparkle,
    title: "Animated templates",
    body: "Three component kits and six moving backgrounds, each with color and speed options.",
  },
  {
    icon: Export,
    title: "Export your way",
    body: "Animated SVG for READMEs, a PNG snapshot, or a GIF captured from the timeline.",
  },
  {
    icon: FloppyDisk,
    title: "Saved on your machine",
    body: "Work autosaves in your browser, and Save writes a design file you can open later.",
  },
];

export default function EditorShowcase() {
  return (
    <Reveal section aria-labelledby="editor-title" className="py-24">
      <div className={container}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-[680px]">
            <p className={`${eyebrow} mb-4`}>Full editor</p>
            <h2 id="editor-title" className="heading-4 md:heading-3 text-zinc-900 mb-4">
              Need more than a name and a tagline?
            </h2>
            <p className="body-3 text-zinc-600">
              The editor is a canvas made for README banners. Start from your quick
              banner or from scratch, and it still exports one animated SVG.
            </p>
          </div>
          <Link to="/editor" className={`${btnSecondary} self-start md:self-auto`}>
            Open the full editor
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-zinc-200 border border-zinc-200">
          {CAPABILITIES.map(({ icon: ItemIcon, title, body }, i) => (
            <li
              key={title}
              className={`p-6 bg-white ${
                i === CAPABILITIES.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <ItemIcon size={24} className="text-[#1b5def] mb-4" aria-hidden="true" />
              <h3 className="title-3 text-zinc-900 mb-1">{title}</h3>
              <p className="body-6 text-zinc-600">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
