import { useEffect, useRef, type ReactNode, type RefObject } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Render as a <section> instead of a <div>. */
  section?: boolean;
  "aria-labelledby"?: string;
}

/**
 * Rises 32px and fades in the first time it enters the viewport, then stays.
 * Uses IntersectionObserver (never a scroll listener) and writes a data
 * attribute directly so revealing never re-renders the subtree. Without
 * IntersectionObserver (old browsers, jsdom) content is shown immediately.
 */
export default function Reveal({ children, className = "", id, section, ...rest }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.visible = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.visible = "true";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const props = {
    id,
    className: `reveal ${className}`,
    "aria-labelledby": rest["aria-labelledby"],
  };

  return section ? (
    <section ref={ref as RefObject<HTMLElement>} {...props}>
      {children}
    </section>
  ) : (
    <div ref={ref as RefObject<HTMLDivElement>} {...props}>
      {children}
    </div>
  );
}
