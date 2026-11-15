import type { Icon } from "@phosphor-icons/react";
import { ArrowsOut, Eye, PencilSimpleLine, Play } from "@phosphor-icons/react";
import Reveal from "./Reveal";
import { container, eyebrow } from "../lib/ui";

const ITEMS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: Play,
    title: "Plays right on your profile",
    body: "The motion is CSS inside the SVG file, so GitHub shows it like any other image in your README. No GIF to record and no image host to keep alive.",
  },
  {
    icon: Eye,
    title: "The preview is the file",
    body: "What you see in the generator is the exact markup you download. There is no render step and no gap between preview and export.",
  },
  {
    icon: ArrowsOut,
    title: "Sharp at every width",
    body: "Vector text and shapes stay crisp on a phone, a laptop, or a 4K monitor, and the file is plain text you can read and tweak by hand.",
  },
  {
    icon: PencilSimpleLine,
    title: "Yours to change later",
    body: "Send any banner to the full editor to add shapes, images, and animated templates, then save a design file to pick it up again.",
  },
];

export default function Features() {
  return (
    <Reveal section aria-labelledby="benefits-title" className="py-24">
      <div className={container}>
        <div className="max-w-[680px] mb-12">
          <p className={`${eyebrow} mb-4`}>Why an SVG</p>
          <h2 id="benefits-title" className="heading-4 md:heading-3 text-zinc-900">
            A moving header without a GIF, a server, or a design tool
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ITEMS.map(({ icon: ItemIcon, title, body }) => (
            <li
              key={title}
              className="bg-white border border-zinc-200 p-6 sm:p-8 transition-colors duration-300 ease-brand hover:border-zinc-300"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 mb-6 bg-[#1b5def]/10 text-[#1b5def]">
                <ItemIcon size={20} weight="bold" aria-hidden="true" />
              </span>
              <h3 className="title-1 text-zinc-900 mb-2">{title}</h3>
              <p className="body-6 text-zinc-600">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
