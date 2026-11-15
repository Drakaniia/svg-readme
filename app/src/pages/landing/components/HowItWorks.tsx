import Reveal from "./Reveal";
import { container, eyebrow } from "../lib/ui";

const STEPS = [
  {
    title: "Write your header",
    body: "Add your name or handle (up to 28 characters) and a tagline (up to 60). The preview updates as you type.",
  },
  {
    title: "Pick a look",
    body: "Choose one of six accent colors or any custom color, a font, light or dark, and one of four motions: fade, sweep, rise, or typewriter.",
  },
  {
    title: "Commit the file",
    body: "Download banner.svg, add it to the repository named after your username, and point to it from README.md.",
  },
];

export default function HowItWorks() {
  return (
    <Reveal section id="how" aria-labelledby="how-title" className="py-24 scroll-mt-24">
      <div className={container}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <p className={`${eyebrow} mb-4`}>How it works</p>
            <h2 id="how-title" className="heading-4 md:heading-3 text-zinc-900 mb-12">
              Three steps from blank profile to moving banner
            </h2>
            <ol className="flex flex-col gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4 items-start">
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 border border-zinc-300 bg-white title-4 text-zinc-900">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="title-2 text-zinc-900 mb-1">{s.title}</h3>
                    <p className="body-6 text-zinc-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <figure className="bg-[#181818] border border-[#313131] lg:sticky lg:top-24">
            <figcaption className="px-6 py-3 border-b border-[#313131] caption-4 text-zinc-400">
              yourname/yourname
            </figcaption>
            <pre className="p-6 font-code caption-2 text-zinc-300 overflow-x-auto whitespace-pre">
              <code>
                <span className="text-zinc-500"># README.md</span>
                {"\n"}
                <span className="text-green-400">![banner](./banner.svg)</span>
                {"\n\n"}
                <span className="text-zinc-500">{"<!-- That is the whole setup."}</span>
                {"\n"}
                <span className="text-zinc-500">{"     No build step, no workflow to keep running. -->"}</span>
              </code>
            </pre>
          </figure>
        </div>
      </div>
    </Reveal>
  );
}
