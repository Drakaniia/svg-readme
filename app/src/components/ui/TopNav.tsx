import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, GithubLogo } from "@phosphor-icons/react";
import { btnNav } from "../../pages/landing/lib/ui";

const REPO_URL = "https://github.com/Wenoxxxx/svg-readme";

const LINKS = [
  { to: "/#studio", label: "Generator" },
  { to: "/#how", label: "How it works" },
  { to: "/#faq", label: "FAQ" },
  { to: "/about", label: "About" },
  { to: "/contacts", label: "Contact" },
];

/** Stagger for mobile menu links: 60ms apart, capped at 400ms total. */
const STEP_MS = 60;
const MAX_DELAY_MS = 400;

function isActive(to: string, pathname: string, hash: string): boolean {
  const [path, anchor] = to.split("#");
  if (anchor) return pathname === "/" && hash === `#${anchor}`;
  return pathname === path;
}

const linkBase =
  "focus-ring no-underline transition-colors duration-300 ease-brand";

export default function TopNav() {
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);

  // Lock page scroll and close on Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  // Router ignores a click on the hash we are already at; scroll anyway.
  const go = (to: string) => {
    close();
    const anchor = to.split("#")[1];
    if (anchor && pathname === "/" && hash === `#${anchor}`) {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="landing-motion">
      <div className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none">
        <nav
          aria-label="Main"
          className="pointer-events-auto w-full md:w-auto flex items-center justify-between gap-6 pl-4 pr-2 py-2 bg-white/75 backdrop-blur-md border border-zinc-200 shadow-sm"
        >
          <Link
            to="/"
            onClick={close}
            className={`${linkBase} flex items-center gap-2 title-3 text-zinc-900`}
          >
            <img
              className="w-6 h-6"
              src={`${import.meta.env.BASE_URL}svg-readme-logo.png`}
              alt=""
              aria-hidden="true"
            />
            svg-readme
          </Link>

          <ul className="hidden md:flex items-center gap-6 list-none m-0 p-0">
            {LINKS.map((l) => {
              const active = isActive(l.to, pathname, hash);
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => go(l.to)}
                    aria-current={active ? "page" : undefined}
                    className={`${linkBase} title-4 ${
                      active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="svg-readme on GitHub (opens in a new tab)"
              className={`${linkBase} hidden sm:inline-flex items-center justify-center w-10 h-10 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100`}
            >
              <GithubLogo size={20} aria-hidden="true" />
            </a>
            <Link to="/editor" className={`${btnNav} hidden sm:inline-flex`}>
              Open editor
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="focus-ring md:hidden relative w-10 h-10 text-zinc-900 hover:bg-zinc-100 transition-colors duration-300 ease-brand"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span
                aria-hidden="true"
                className={`absolute left-3 right-3 top-1/2 h-0.5 bg-current transition-transform duration-500 ease-brand ${
                  open ? "translate-y-0 rotate-45" : "-translate-y-1"
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute left-3 right-3 top-1/2 h-0.5 bg-current transition-transform duration-500 ease-brand ${
                  open ? "translate-y-0 -rotate-45" : "translate-y-1"
                }`}
              />
            </button>
          </div>
        </nav>
      </div>

      <div
        id="mobile-menu"
        inert={!open}
        aria-hidden={!open}
        className={`md:hidden fixed inset-0 z-40 bg-[#fafafa]/95 backdrop-blur-xl transition-opacity duration-500 ease-brand ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <nav aria-label="Mobile" className="h-full flex flex-col px-6 pt-24 pb-8">
          <ul className="flex flex-col gap-2 list-none m-0 p-0">
            {[...LINKS, { to: "/editor", label: "Open editor" }].map((l, i) => {
              const active = isActive(l.to, pathname, hash);
              return (
                <li
                  key={l.to}
                  className={`transition-[opacity,transform] duration-500 ease-brand ${
                    open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  }`}
                  style={{ transitionDelay: open ? `${Math.min(i * STEP_MS, MAX_DELAY_MS)}ms` : "0ms" }}
                >
                  <Link
                    to={l.to}
                    onClick={() => go(l.to)}
                    aria-current={active ? "page" : undefined}
                    className={`${linkBase} block py-2 heading-5 ${
                      active ? "text-[#1b5def]" : "text-zinc-900 hover:text-[#1b5def]"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkBase} mt-auto inline-flex items-center gap-2 body-5 text-zinc-600 hover:text-zinc-900`}
          >
            <GithubLogo size={20} aria-hidden="true" />
            Source on GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
