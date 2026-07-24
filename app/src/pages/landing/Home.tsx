import { useState, useMemo } from "react";

export default function Home() {
  const [handle, setHandle] = useState("Owen Jerusalem");
  const [tagline, setTagline] = useState(
    "BSIT student · freelance designer · builder",
  );
  const [color, setColor] = useState("#2563eb");
  const [motion, setMotion] = useState<"fade" | "sweep">("fade");
  const [size, setSize] = useState("800x200");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const swatches = [
    { name: "Blue", value: "#2563eb" },
    { name: "Ink", value: "#18181b" },
    { name: "Emerald", value: "#059669" },
    { name: "Rose", value: "#e11d48" },
    { name: "Amber", value: "#d97706" },
    { name: "Violet", value: "#7c3aed" },
  ];

  const flashToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(""), 300);
    }, 2200);
  };

  const svgString = useMemo(() => {
    const [w, h] = size.split("x").map(Number);
    const uid =
      "sr" +
      [handle, tagline, color, motion, size, theme]
        .join("-")
        .split("")
        .reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)
        .toString(36)
        .slice(0, 6);
    const dark = theme === "dark";
    const bg = dark ? "#09090b" : "#ffffff";
    const ink = dark ? "#fafafa" : "#18181b";
    const inkSoft = dark ? "#a1a1aa" : "#52525b";
    const border = dark ? "#27272a" : "#e4e4e7";
    const words = tagline.split(" ");

    let motionCSS: string;
    let motionMarkup: string;

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (motion === "fade") {
      motionCSS =
        words
          .map(
            (_, i) => `
        .${uid}-w${i}{opacity:0;animation:${uid}fade .5s ease forwards;animation-delay:${0.25 + i * 0.09}s;}
      `,
          )
          .join("") +
        `
        @keyframes ${uid}fade{to{opacity:1;}}
        .${uid}-handle{opacity:0;animation:${uid}fade .5s ease forwards;animation-delay:0.05s;}
        .${uid}-dot{animation:${uid}pulse 1.6s ease-in-out infinite;}
        @keyframes ${uid}pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
      `;
      let x = w * 0.065;
      const tagY = h * 0.62;
      motionMarkup = words
        .map((word, i) => {
          const width = word.length * 7.2 + 10;
          const el = `<tspan class="${uid}-w${i}" x="${x.toFixed(1)}" y="${tagY}">${esc(word)}</tspan>`;
          x += width;
          return el;
        })
        .join("");
    } else {
      motionCSS = `
        .${uid}-handle{opacity:0;animation:${uid}fadeIn .6s ease forwards .1s;}
        .${uid}-tag{opacity:0;animation:${uid}fadeIn .6s ease forwards .3s;}
        @keyframes ${uid}fadeIn{to{opacity:1;}}
        .${uid}-sweep{animation:${uid}sweep 2.6s ease-in-out infinite;}
        @keyframes ${uid}sweep{
          0%{transform:translateX(-30%);}
          50%{transform:translateX(${w}px);}
          100%{transform:translateX(${w}px);}
        }
        .${uid}-dot{animation:${uid}pulse 1.6s ease-in-out infinite;}
        @keyframes ${uid}pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
      `;
      motionMarkup = `<tspan class="${uid}-tag" x="${(w * 0.065).toFixed(1)}" y="${h * 0.62}">${esc(tagline)}</tspan>`;
    }

    const sweepRect =
      motion === "sweep"
        ? `<rect class="${uid}-sweep" x="0" y="0" width="${(w * 0.18).toFixed(0)}" height="${h}" fill="${color}" opacity="0.10"/>`
        : "";

    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(handle)} banner">
  <style>text{font-family:'JetBrains Mono',ui-monospace,monospace;}${motionCSS}</style>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="${bg}" stroke="${border}" rx="4"/>
  ${sweepRect}
  <rect x="${(w * 0.065).toFixed(1)}" y="${(h * 0.22).toFixed(1)}" width="10" height="10" fill="${color}" class="${uid}-dot" rx="2"/>
  <text class="${uid}-handle" x="${(w * 0.065 + 18).toFixed(1)}" y="${(h * 0.3).toFixed(1)}" font-size="${Math.round(h * 0.16)}" font-weight="600" fill="${ink}">${esc(handle)}</text>
  <text font-size="${Math.round(h * 0.085)}" fill="${inkSoft}">${motionMarkup}</text>
</svg>`;
  }, [handle, tagline, color, motion, size, theme]);

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
    flashToast("Downloaded banner.svg");
  };

  const handleCopyMarkdown = () => {
    const md = "![banner](./banner.svg)";
    navigator.clipboard
      .writeText(md)
      .then(() => flashToast("Copied to clipboard"))
      .catch(() => flashToast("Copy failed"));
  };

  const [svgW, svgH] = size.split("x").map(Number);
  const aspectRatio = svgW / svgH;

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16">
        <div className="absolute -top-[200px] -right-[100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(37,99,235,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-blue-600 mb-5">
            <span className="w-[6px] h-[6px] bg-blue-600 rounded-full" />
            GitHub Profile READMEs
          </div>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight max-w-[700px] mb-5">
            An animated banner for your README, built{" "}
            <em className="text-blue-600 not-normal relative">
              in the browser
              <span className="absolute bottom-[2px] left-0 right-0 h-2 bg-blue-600/10 rounded-sm -z-10" />
            </em>
            , not in Figma.
          </h1>
          <p className="text-lg text-zinc-500 max-w-[520px] leading-[1.7]">
            Type your handle and tagline, pick an accent and a motion style, and
            export a real SVG with the keyframes baked in — no rendering
            pipeline required.
          </p>
        </div>
      </section>

      {/* Studio */}
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.06)] mb-20">
          {/* Controls */}
          <div className="p-7 border-b md:border-b-0 md:border-r border-zinc-200 bg-white flex flex-col gap-7 overflow-y-auto max-h-[720px] md:max-h-none">
            {/* Content */}
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-2">
                <span className="text-blue-600 font-semibold">01</span>
                Content
              </div>
              <div>
                <input
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-[13px] text-zinc-900 bg-white outline-none transition-all focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  maxLength={28}
                  placeholder="Your name or handle"
                />
                <div className="text-[10px] text-zinc-400 text-right mt-1 font-mono">
                  {handle.length}/28
                </div>
              </div>
              <div>
                <input
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-[13px] text-zinc-900 bg-white outline-none transition-all focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={60}
                  placeholder="Your tagline"
                />
                <div className="text-[10px] text-zinc-400 text-right mt-1 font-mono">
                  {tagline.length}/60
                </div>
              </div>
            </div>

            {/* Accent */}
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-2">
                <span className="text-blue-600 font-semibold">02</span>
                Accent Color
              </div>
              <div className="flex gap-2.5 flex-wrap">
                {swatches.map((s) => (
                  <button
                    key={s.value}
                    className={`w-8 h-8 rounded-lg border-2 cursor-pointer transition-all hover:scale-110 relative ${
                      color === s.value
                        ? "border-zinc-900 shadow-[0_0_0_2px_white,0_0_0_4px_#18181b]"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: s.value }}
                    onClick={() => setColor(s.value)}
                    title={s.name}
                  />
                ))}
              </div>
            </div>

            {/* Motion */}
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-2">
                <span className="text-blue-600 font-semibold">03</span>
                Motion
              </div>
              <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
                <button
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    motion === "fade"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                  onClick={() => setMotion("fade")}
                >
                  Fade cascade
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    motion === "sweep"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                  onClick={() => setMotion("sweep")}
                >
                  Gradient sweep
                </button>
              </div>
            </div>

            {/* Size & Theme */}
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400 flex items-center gap-2">
                <span className="text-blue-600 font-semibold">04</span>
                Size & Theme
              </div>
              <select
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-[13px] text-zinc-900 bg-white outline-none appearance-none cursor-pointer transition-all focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2352525B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: "32px",
                }}
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="800x200">800 × 200 — Standard</option>
                <option value="1000x220">1000 × 220 — Wide</option>
                <option value="640x160">640 × 160 — Compact</option>
              </select>
              <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
                <button
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    theme === "light"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  Light
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    theme === "dark"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>

          {/* Stage */}
          <div className="bg-zinc-950 p-8 flex flex-col gap-5 relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 relative z-10">
              Live Preview
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[200px] relative z-10">
              <div
                className="bg-zinc-900 rounded-xl border border-white/[0.08] shadow-[0_25px_60px_-12px_rgba(0,0,0,0.8)] overflow-hidden transition-transform duration-300 hover:scale-[1.01] w-full max-w-[800px]"
                style={{ aspectRatio }}
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            </div>
            <div className="flex gap-2.5 items-center flex-wrap relative z-10">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-[13px] font-medium rounded-lg border-0 hover:bg-blue-700 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] cursor-pointer transition-all whitespace-nowrap"
                onClick={handleDownload}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download SVG
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.06] text-zinc-200 text-[13px] font-medium rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/[0.15] cursor-pointer transition-all whitespace-nowrap"
                onClick={handleCopyMarkdown}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"
                  />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Markdown
              </button>
              <span
                className={`font-mono text-[11px] text-green-400 transition-opacity duration-300 ml-auto ${
                  toastVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                {toast}
              </span>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg py-2.5 px-3.5 relative z-10">
              <code className="text-[12px] text-zinc-400 overflow-x-auto whitespace-nowrap block font-mono">
                <span className="text-green-400">![banner]</span>
                (./banner.svg)
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[600px] mb-12">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400 mb-3">
              <span className="w-[6px] h-[6px] bg-zinc-400 rounded-full" />
              Why not just a static image
            </div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight">
              Three things a GIF or screenshot can&apos;t do
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 rounded-2xl overflow-hidden">
            <div className="bg-white p-8 transition-colors hover:bg-zinc-50">
              <span className="inline-block font-mono text-[11px] text-blue-600 font-medium mb-4 px-2 py-1 bg-blue-600/5 rounded">
                01
              </span>
              <h3 className="text-[17px] font-semibold mb-2.5 tracking-tight">
                Real keyframes, not frames
              </h3>
              <p className="text-sm text-zinc-500 leading-[1.7]">
                The animation is CSS inside the SVG&apos;s own &lt;style&gt;
                block — it plays natively wherever the SVG renders, with no
                frame count and no file-size penalty for smoothness.
              </p>
            </div>
            <div className="bg-white p-8 transition-colors hover:bg-zinc-50">
              <span className="inline-block font-mono text-[11px] text-blue-600 font-medium mb-4 px-2 py-1 bg-blue-600/5 rounded">
                02
              </span>
              <h3 className="text-[17px] font-semibold mb-2.5 tracking-tight">
                What you see is what ships
              </h3>
              <p className="text-sm text-zinc-500 leading-[1.7]">
                The preview on this page is the exact markup you download. No
                separate render step, no &quot;close enough&quot; gap between
                the editor and the export.
              </p>
            </div>
            <div className="bg-white p-8 transition-colors hover:bg-zinc-50">
              <span className="inline-block font-mono text-[11px] text-blue-600 font-medium mb-4 px-2 py-1 bg-blue-600/5 rounded">
                03
              </span>
              <h3 className="text-[17px] font-semibold mb-2.5 tracking-tight">
                Your brand, not a template
              </h3>
              <p className="text-sm text-zinc-500 leading-[1.7]">
                Accent, size, and motion are parameters, not presets baked into
                someone else&apos;s generator — set them once to match the rest
                of your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="bg-zinc-100 rounded-3xl py-16 mb-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
              <div>
                <div className="max-w-[560px] mb-8">
                  <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400 mb-3">
                    <span className="w-[6px] h-[6px] bg-zinc-400 rounded-full" />
                    Under the hood
                  </div>
                  <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight">
                    How it renders
                  </h2>
                </div>
                <div className="flex flex-col gap-8">
                  <div className="flex gap-5 items-start">
                    <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center font-mono text-xs font-semibold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold mb-1.5">
                        Layout via React + Satori
                      </h4>
                      <p className="text-sm text-zinc-500 leading-[1.7]">
                        Content and layout are described as React, then flattened
                        to SVG server-side — the same approach used for OG-image
                        generation.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5 items-start">
                    <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center font-mono text-xs font-semibold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold mb-1.5">
                        Keyframes injected after render
                      </h4>
                      <p className="text-sm text-zinc-500 leading-[1.7]">
                        Satori&apos;s output has no animation support, so the
                        motion CSS is hand-written and injected into the SVG&apos;s
                        &lt;style&gt; as a post-process step.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-5 items-start">
                    <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center font-mono text-xs font-semibold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold mb-1.5">
                        Export, then commit
                      </h4>
                      <p className="text-sm text-zinc-500 leading-[1.7]">
                        Download the SVG, drop it in your repo, and reference it
                        with a standard markdown image tag — GitHub renders the
                        animation as-is.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-950 rounded-2xl p-7 font-mono text-[13px] leading-[2] text-zinc-200 border border-white/[0.06] md:sticky md:top-6">
                <div className="text-zinc-600"># README.md</div>
                <div className="text-green-400">![banner](./banner.svg)</div>
                <br />
                <div className="text-zinc-600">
                  &lt;!-- that&apos;s it — no build step,
                </div>
                <div className="text-zinc-600">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;no external image host,
                </div>
                <div className="text-zinc-600">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;no action to keep running --&gt;
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-[1200px] mx-auto px-6">
        <footer className="border-t border-zinc-200 py-8 flex justify-between items-center flex-wrap gap-4">
          <span className="font-mono text-xs text-zinc-400">
            svg-readme — built by Owen Jerusalem
          </span>
          <a
            className="text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors no-underline"
            href="https://github.com/Wenoxxxx"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/Wenoxxxx
          </a>
        </footer>
      </div>
    </div>
  );
}