import { ArrowUp } from "@phosphor-icons/react";
import Reveal from "./Reveal";
import { btnPrimary, container } from "../lib/ui";

export default function FinalCta() {
  return (
    <Reveal section aria-labelledby="cta-title" className="pb-24">
      <div className={container}>
        <div className="bg-[#181818] border border-[#313131] px-6 py-16 sm:px-12 text-center flex flex-col items-center">
          <h2 id="cta-title" className="heading-4 md:heading-3 text-white max-w-[680px] mb-4">
            Your profile is one file away from a moving header
          </h2>
          <p className="body-3 text-zinc-400 max-w-[520px] mb-8">
            Free, open source, and no account needed. Your banner never leaves
            your browser until you download it.
          </p>
          <a href="#studio" className={btnPrimary}>
            Design your banner
            <ArrowUp size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Reveal>
  );
}
