import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Hero from "./components/Hero";
import StudioControls from "./components/StudioControls";
import StudioPreview from "./components/StudioPreview";
import Features from "./components/Features";
import TaglineReveal from "./components/TaglineReveal";
import HowItWorks from "./components/HowItWorks";
import EditorShowcase from "./components/EditorShowcase";
import Faq from "./components/Faq";
import FinalCta from "./components/FinalCta";
import Reveal from "./components/Reveal";
import { buildQuickBanner, QUICK_SWATCHES, QUICK_MOTIONS, QUICK_FONTS } from "./lib/quickBanner";
import type { QuickMotion, QuickTheme, QuickFont } from "./lib/quickBanner";
import { saveQuickHandoff } from "./lib/quickHandoff";
import { container, eyebrow } from "./lib/ui";

const DEFAULTS = {
  handle: "Owen Jerusalem",
  tagline: "BSIT student · freelance designer · builder",
  color: "#1b5def",
  motion: "fade" as QuickMotion,
  size: "800x200",
  theme: "light" as QuickTheme,
  font: "mono" as QuickFont,
  gradient: false,
};

const SIZES = ["800x200", "1000x220", "640x160"];

const COPY_FAILED = "Copy failed. Your browser blocked clipboard access, so use Download SVG instead.";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Home() {
  const navigate = useNavigate();
  const [handle, setHandle] = useState(DEFAULTS.handle);
  const [tagline, setTagline] = useState(DEFAULTS.tagline);
  const [color, setColor] = useState(DEFAULTS.color);
  const [motion, setMotion] = useState<QuickMotion>(DEFAULTS.motion);
  const [size, setSize] = useState(DEFAULTS.size);
  const [theme, setTheme] = useState<QuickTheme>(DEFAULTS.theme);
  const [font, setFont] = useState<QuickFont>(DEFAULTS.font);
  const [gradient, setGradient] = useState(DEFAULTS.gradient);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const flashToast = (msg: string, error = false) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    setToastError(error);
    setToastVisible(true);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), error ? 4000 : 2200);
  };

  const svgString = useMemo(
    () => buildQuickBanner({ handle, tagline, color, motion, size, theme, font, gradient }),
    [handle, tagline, color, motion, size, theme, font, gradient],
  );

  const handleDownload = () => {
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "banner.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flashToast("Saved banner.svg to your downloads");
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard
      .writeText("![banner](./banner.svg)")
      .then(() => flashToast("Markdown copied. Paste it into README.md"))
      .catch(() => flashToast(COPY_FAILED, true));
  };

  const handleCopySvg = () => {
    navigator.clipboard
      .writeText(svgString)
      .then(() => flashToast("SVG markup copied"))
      .catch(() => flashToast(COPY_FAILED, true));
  };

  const handleOpenEditor = () => {
    saveQuickHandoff({ handle, tagline, color, motion, size, theme, font, gradient });
    navigate("/editor");
  };

  const handleRandomize = () => {
    setColor(pick(QUICK_SWATCHES).value);
    setMotion(pick(QUICK_MOTIONS).id);
    setFont(pick(QUICK_FONTS).id);
    setSize(pick(SIZES));
    setGradient(Math.random() < 0.5);
    setTheme(Math.random() < 0.5 ? "dark" : "light");
    flashToast("Style shuffled. Your text stayed the same");
  };

  const handleReset = () => {
    setHandle(DEFAULTS.handle);
    setTagline(DEFAULTS.tagline);
    setColor(DEFAULTS.color);
    setMotion(DEFAULTS.motion);
    setSize(DEFAULTS.size);
    setTheme(DEFAULTS.theme);
    setFont(DEFAULTS.font);
    setGradient(DEFAULTS.gradient);
    flashToast("Back to the default banner");
  };

  const [svgW, svgH] = size.split("x").map(Number);
  const aspectRatio = svgW / svgH;

  return (
    <div className="landing-motion">
      <Hero />

      <Reveal section id="studio" aria-labelledby="studio-title" className="pb-24 scroll-mt-24">
        <div className={container}>
          <div className="max-w-[680px] mb-8">
            <p className={`${eyebrow} mb-4`}>Generator</p>
            <h2 id="studio-title" className="heading-4 md:heading-3 text-zinc-900 mb-4">
              Build your banner
            </h2>
            <p className="body-3 text-zinc-600">
              Every change updates the preview right away. Download when it looks
              right, or send it to the full editor to keep going.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <StudioControls
              handle={handle}
              tagline={tagline}
              color={color}
              motion={motion}
              size={size}
              theme={theme}
              font={font}
              gradient={gradient}
              onHandle={setHandle}
              onTagline={setTagline}
              onColor={setColor}
              onMotion={setMotion}
              onSize={setSize}
              onTheme={setTheme}
              onFont={setFont}
              onGradient={setGradient}
              onRandomize={handleRandomize}
              onReset={handleReset}
            />
            <StudioPreview
              svgString={svgString}
              aspectRatio={aspectRatio}
              toast={toast}
              toastVisible={toastVisible}
              toastError={toastError}
              onDownload={handleDownload}
              onCopyMarkdown={handleCopyMarkdown}
              onCopySvg={handleCopySvg}
              onOpenEditor={handleOpenEditor}
            />
          </div>
        </div>
      </Reveal>

      <Features />
      <TaglineReveal />
      <HowItWorks />
      <EditorShowcase />
      <Faq />
      <FinalCta />
    </div>
  );
}
