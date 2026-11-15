import { useState } from "react";
import { ArrowClockwise, ArrowDown, Check, FileText } from "@phosphor-icons/react";
import { buildQuickBanner } from "../lib/quickBanner";
import { btnPrimary, container, eyebrow } from "../lib/ui";

/** Built once from fixed options: this is real output from the studio below. */
const HERO_BANNER = buildQuickBanner({
  handle: "Owen Jerusalem",
  tagline: "BSIT student · freelance designer · builder",
  color: "#1b5def",
  motion: "rise",
  size: "800x200",
  theme: "dark",
  font: "display",
  gradient: true,
});

const PROOF = ["Free and open source (MIT)", "No account needed", "Runs in your browser"];

export default function Hero() {
  // Changing the key remounts the SVG, which restarts its CSS keyframes.
  const [playKey, setPlayKey] = useState(0);

  return (
    <section aria-labelledby="hero-title" className="pt-16 pb-24 landing-motion">
      <div className={container}>
        <div className="max-w-[680px]">
          <p className={`${eyebrow} mb-6`}>
            <span aria-hidden="true" className="w-2 h-2 bg-[#1b5def]" />
            For GitHub profile READMEs
          </p>
          <h1
            id="hero-title"
            className="heading-3 sm:heading-2 lg:heading-1 pb-2 mb-4 text-transparent bg-clip-text bg-[linear-gradient(90deg,#000000,#666666)]"
          >
            <span className="block">Animated banners</span>{" "}
            <span className="block">for your GitHub</span>{" "}
            <span className="block">profile README</span>
          </h1>
          <p className="body-3 sm:title-2 sm:font-normal text-zinc-600 mb-8">
            Type your name and a tagline, pick a color and a motion, then download
            a real SVG with the animation built in. Nothing to install, nothing to
            sign up for.
          </p>
          <a href="#studio" className={btnPrimary}>
            Design your banner
            <ArrowDown size={16} weight="bold" aria-hidden="true" />
          </a>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {PROOF.map((item) => (
              <li key={item} className="flex items-center gap-2 caption-1 text-zinc-600">
                <Check size={16} weight="bold" className="text-[#1b5def]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <figure className="mt-16 border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-zinc-200">
            <span className="flex items-center gap-2 caption-4 font-code text-zinc-600">
              <FileText size={16} aria-hidden="true" />
              README.md
            </span>
            <button
              type="button"
              onClick={() => setPlayKey((k) => k + 1)}
              className="focus-ring inline-flex items-center gap-2 px-2 py-1 button-xsm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 active:scale-[0.98] transition-[background-color,color,transform] duration-300 ease-brand"
            >
              <ArrowClockwise size={16} aria-hidden="true" />
              Replay
            </button>
          </div>
          <div className="p-4 sm:p-8">
            <div
              key={playKey}
              className="w-full aspect-[4/1] overflow-hidden [&>svg]:block [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: HERO_BANNER }}
            />
          </div>
          <figcaption className="px-4 pb-4 sm:px-8 sm:pb-8 caption-2 text-zinc-500">
            Made with the generator below. The download is a plain SVG file you can open and read.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
