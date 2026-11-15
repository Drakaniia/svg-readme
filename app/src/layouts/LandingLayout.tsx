import TopNav from "../components/ui/TopNav";
import LandingFooter from "../pages/landing/components/LandingFooter";
import { Outlet } from "react-router-dom";

export default function LandingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] text-zinc-900 font-display antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-3 focus:py-2 focus:bg-zinc-900 focus:text-white button-sm focus-ring"
      >
        Skip to content
      </a>

      {/* Shared floating navigation */}
      <TopNav />

      {/* Page content changes depending on route; pt clears the fixed nav. */}
      <main id="main" className="flex-1 pt-24 scroll-mt-24">
        <Outlet />
      </main>

      <LandingFooter />
    </div>
  );
}
