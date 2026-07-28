import { Link } from "react-router-dom";

export default function TopNav() {
  return (
    <nav className="border-b border-zinc-200 bg-white sticky top-0 z-50">
      <div className="flex items-center justify-between py-[18px] px-6 max-w-[1180px] mx-auto">
        <Link
          to="/"
          className="flex items-center gap-2 font-['Poppins'] font-semibold text-[17px] text-zinc-900 no-underline"
        >
          <img className="w-7 h-7 0 flex items-center justify-center" src="/svg-readme-logo.png" />
          svg-readme
        </Link>
        <div className="flex gap-7 items-center">
          <a
            href="#studio"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors no-underline"
          >
            Generator
          </a>
          <a
            href="#how"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors no-underline"
          >
            How it works
          </a>
          <Link
            to="/editor"
            className="text-sm text-[#1b5def] font-semibold hover:text-blue-700 transition-colors no-underline"
          >
            Full Editor →
          </Link>
        </div>
        <a
          className="font-mono text-[13px] border border-zinc-900 px-3.5 py-2 text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap no-underline"
          href="https://github.com/Wenoxxxx/svg-readme"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
