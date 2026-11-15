import { Plus } from "@phosphor-icons/react";
import Reveal from "./Reveal";
import { container, eyebrow } from "../lib/ui";

export const FAQ_ITEMS = [
  {
    q: "Will the animation play on my GitHub profile?",
    a: "Yes. GitHub shows SVG files in a README as images, and the CSS animation inside the file plays in the visitor's browser. Commit the file and reference it with a normal Markdown image.",
  },
  {
    q: "Do I need an account?",
    a: "No. There is no sign up and no login. Open the page, make a banner, and download it.",
  },
  {
    q: "Is anything I type uploaded?",
    a: "No. Banners are built in your browser. The full editor autosaves to your browser's local storage, and design files are saved to your own computer.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. svg-readme is free and open source under the MIT license, and the code is on GitHub.",
  },
  {
    q: "Where do I put the file?",
    a: "In your profile repository, the one with the same name as your username. Save banner.svg next to README.md and add ![banner](./banner.svg) where you want it to appear.",
  },
  {
    q: "Can I change my banner after downloading it?",
    a: "Use Open in full editor before you download to turn your settings into editable layers. In the editor, Save writes a design file you can reopen later, and you can drop any SVG onto the canvas to bring its shapes in.",
  },
  {
    q: "Can I export a GIF or a PNG instead?",
    a: "Yes, from the Export tab in the full editor: animated SVG, a static PNG, or an animated GIF captured from the timeline. The quick generator on this page exports SVG.",
  },
];

export default function Faq() {
  return (
    <Reveal section id="faq" aria-labelledby="faq-title" className="py-24 scroll-mt-24">
      <div className={`${container} grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12`}>
        <div>
          <p className={`${eyebrow} mb-4`}>FAQ</p>
          <h2 id="faq-title" className="heading-4 md:heading-3 text-zinc-900">
            Questions people ask first
          </h2>
        </div>
        <div className="border border-zinc-200 bg-white divide-y divide-zinc-200">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group">
              <summary className="focus-ring flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden title-3 text-zinc-900 hover:bg-zinc-50 transition-colors duration-300 ease-brand">
                {item.q}
                <Plus
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  className="flex-shrink-0 text-zinc-500 transition-transform duration-500 ease-brand group-open:rotate-45"
                />
              </summary>
              <p className="px-6 pb-6 body-6 text-zinc-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
