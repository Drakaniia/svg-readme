import { useEffect, useRef } from "react";
import { container } from "../lib/ui";

/** Each line is its own block so breaks land where the thought breaks. */
const LINES = [
  "Your profile README sits",
  "at the top of your GitHub page.",
  "Give it a header that moves,",
  "saved as one SVG file in your repo.",
];

const STEP_MS = 60;

/**
 * Large type statement whose words brighten from 30% to full ink one at a
 * time as they cross a trigger line 40% above the bottom of the viewport.
 * Words that cross in the same frame (one visual line) are staggered 60ms
 * apart in reading order. Reduced motion shows full ink straight away (CSS).
 */
export default function TaglineReveal() {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>(".tagline-word"));
    if (typeof IntersectionObserver === "undefined") {
      words.forEach((w) => (w.dataset.active = "true"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const reached = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
        reached.forEach((w, i) => {
          w.style.transitionDelay = `${i * STEP_MS}ms`;
          w.dataset.active = "true";
          io.unobserve(w);
        });
      },
      { rootMargin: "0px 0px -40% 0px", threshold: 1 },
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);

  let index = 0;
  return (
    <section aria-label="Why an animated header" className="py-24">
      <div className={container}>
        <p ref={ref} className="heading-4 md:heading-3 text-zinc-900 max-w-[680px]">
          {LINES.map((line) => (
            <span key={line} className="block">
              {line.split(" ").map((word) => {
                const i = index++;
                return (
                  <span key={i}>
                    <span className="tagline-word" data-index={i}>
                      {word}
                    </span>{" "}
                  </span>
                );
              })}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
