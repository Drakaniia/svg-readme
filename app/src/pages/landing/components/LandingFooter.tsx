import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, GithubLogo } from "@phosphor-icons/react";

const linkCls =
  "focus-ring inline-flex items-center gap-1 no-underline text-inherit hover:text-white transition-colors duration-300 ease-brand";

const heading = "caption-3 uppercase tracking-wider text-zinc-500 mb-4";

const CREATORS = [
  { name: "Wenoxxxx", href: "https://github.com/Wenoxxxx" },
  { name: "Drakaniia", href: "https://github.com/Drakaniia" },
];

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#131209] text-zinc-400 font-display">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-16 pb-8">
        <div className="flex justify-between items-center flex-wrap gap-6 pb-10 border-b border-white/10">
          <Link to="/" className="focus-ring flex items-center gap-2 no-underline">
            <img
              className="w-6 h-6"
              src={`${import.meta.env.BASE_URL}svg-readme-logo.png`}
              alt=""
              aria-hidden="true"
            />
            <span className="title-2 text-white">svg-readme</span>
          </Link>
          <a
            className="focus-ring inline-flex items-center gap-2 button-sm border border-white/20 px-3 py-2 text-zinc-200 hover:bg-white hover:text-zinc-950 hover:border-white transition-colors duration-300 ease-brand whitespace-nowrap no-underline"
            href="https://github.com/Wenoxxxx/svg-readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubLogo size={16} aria-hidden="true" />
            Star on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 py-10">
          <div>
            <p className={heading}>svg-readme</p>
            <p className="body-6 max-w-[280px]">
              Animated SVG banners for your GitHub profile README, designed in the
              browser and exported with the animation built in.
            </p>
          </div>

          <nav aria-label="Footer explore">
            <p className={heading}>Explore</p>
            <ul className="flex flex-col gap-3 body-6">
              <li>
                <a href="/#studio" className={linkCls}>
                  Generator
                </a>
              </li>
              <li>
                <a href="/#how" className={linkCls}>
                  How it works
                </a>
              </li>
              <li>
                <a href="/#faq" className={linkCls}>
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/about" className={linkCls}>
                  About
                </Link>
              </li>
              <li>
                <Link to="/contacts" className={linkCls}>
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/editor" className={`${linkCls} text-[#5b8cff] font-semibold`}>
                  Full editor
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Footer creators">
            <p className={heading}>Creators</p>
            <ul className="flex flex-col gap-3 body-6">
              {CREATORS.map((c) => (
                <li key={c.name}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    {c.name}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10 pt-6 flex justify-between items-center flex-wrap gap-3 caption-5 text-zinc-500">
          <span>
            Made by{" "}
            {CREATORS.map((c, i) => (
              <span key={c.name}>
                {i > 0 && " and "}
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring text-zinc-200 hover:text-white transition-colors duration-300 ease-brand no-underline"
                >
                  {c.name}
                </a>
              </span>
            ))}
          </span>
          <span>MIT license · {year}</span>
        </div>
      </div>
    </footer>
  );
}
