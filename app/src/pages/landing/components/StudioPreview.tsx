import { useState } from "react";
import { ArrowRight, Code, DownloadSimple, MarkdownLogo } from "@phosphor-icons/react";

interface Props {
  svgString: string;
  aspectRatio: number;
  toast: string;
  toastVisible: boolean;
  /** Show the status line as a failure rather than a confirmation. */
  toastError?: boolean;
  onDownload: () => void;
  onCopyMarkdown: () => void;
  onCopySvg: () => void;
  onOpenEditor: () => void;
}

const motionCls =
  "focus-ring transition-[background-color,border-color,color,transform] duration-300 ease-brand active:scale-[0.98]";

const ghostBtn = `inline-flex items-center gap-2 px-3 py-2 button-sm text-zinc-200 bg-[#272727] border border-[#313131] hover:bg-[#313131] hover:text-white whitespace-nowrap ${motionCls}`;

function tabBtn(active: boolean) {
  return `px-3 py-1 button-xsm ${motionCls} ${
    active ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
  }`;
}

export default function StudioPreview({
  svgString,
  aspectRatio,
  toast,
  toastVisible,
  toastError = false,
  onDownload,
  onCopyMarkdown,
  onCopySvg,
  onOpenEditor,
}: Props) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="bg-[#181818] p-4 sm:p-8 flex flex-col gap-6 min-w-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 caption-3 uppercase tracking-wider text-zinc-400">
          <span aria-hidden="true" className="w-2 h-2 bg-green-400" />
          Live preview
        </div>
        <div className="flex bg-[#272727] p-1 gap-1" role="group" aria-label="Preview view">
          <button type="button" aria-pressed={!showCode} onClick={() => setShowCode(false)} className={tabBtn(!showCode)}>
            Preview
          </button>
          <button type="button" aria-pressed={showCode} onClick={() => setShowCode(true)} className={tabBtn(showCode)}>
            SVG
          </button>
        </div>
      </div>

      {showCode ? (
        <pre className="flex-1 min-h-[200px] max-h-[320px] overflow-auto bg-black border border-[#313131] p-4 font-code caption-5 text-zinc-300 whitespace-pre-wrap break-all">
          {svgString}
        </pre>
      ) : (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <div
            className="bg-[#1F1F1F] border border-[#313131] shadow-lg overflow-hidden w-full max-w-[800px] [&>svg]:block [&>svg]:w-full [&>svg]:h-full"
            style={{ aspectRatio }}
            dangerouslySetInnerHTML={{ __html: svgString }}
          />
        </div>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <button
          type="button"
          onClick={onDownload}
          className={`inline-flex items-center gap-2 px-3 py-2 button-sm bg-[#1b5def] text-white border border-[#1b5def] hover:bg-[#164ecb] whitespace-nowrap ${motionCls}`}
        >
          <DownloadSimple size={16} weight="bold" aria-hidden="true" />
          Download SVG
        </button>
        <button type="button" onClick={onCopySvg} className={ghostBtn}>
          <Code size={16} weight="bold" aria-hidden="true" />
          Copy SVG
        </button>
        <button type="button" onClick={onCopyMarkdown} className={ghostBtn}>
          <MarkdownLogo size={16} weight="bold" aria-hidden="true" />
          Copy Markdown
        </button>
        <button
          type="button"
          onClick={onOpenEditor}
          className={`inline-flex items-center gap-2 px-3 py-2 button-sm text-zinc-200 border border-[#1b5def] hover:bg-[#1b5def] hover:text-white whitespace-nowrap ${motionCls}`}
        >
          Open in full editor
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="bg-black border border-[#313131] px-4 py-3">
        <code className="block font-code caption-5 text-zinc-400 overflow-x-auto whitespace-nowrap">
          <span className="text-green-400">![banner]</span>(./banner.svg)
        </code>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`caption-4 min-h-4 transition-opacity duration-300 ease-brand ${
          toastError ? "text-amber-400" : "text-green-400"
        } ${
          toastVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {toast}
      </p>
    </div>
  );
}
