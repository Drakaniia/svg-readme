import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../pages/landing/Home";
import TopNav from "../../components/ui/TopNav";
import { FAQ_ITEMS } from "../../pages/landing/components/Faq";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Home />
    </MemoryRouter>,
  );
}

describe("landing home", () => {
  it("leads with one headline and points every primary CTA at the studio", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Animated banners for your GitHub profile README",
    );
    const ctas = screen.getAllByRole("link", { name: /design your banner/i });
    expect(ctas).toHaveLength(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "#studio"));
    expect(document.getElementById("studio")).not.toBeNull();
  });

  it("lists every FAQ question", () => {
    renderHome();
    const faq = document.getElementById("faq")!;
    FAQ_ITEMS.forEach((item) => expect(within(faq).getByText(item.q)).toBeInTheDocument());
  });

  it("shows tagline words at full ink when IntersectionObserver is unavailable", () => {
    renderHome();
    const words = document.querySelectorAll<HTMLElement>(".tagline-word");
    expect(words.length).toBeGreaterThan(10);
    words.forEach((w) => expect(w.dataset.active).toBe("true"));
  });

  it("announces studio actions in a status line", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /shuffle/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Style shuffled");
  });
});

describe("landing nav", () => {
  it("opens and closes the mobile menu, including with Escape", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <TopNav />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("marks the current page in the navigation", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <TopNav />
      </MemoryRouter>,
    );
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    expect(within(main).getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
  });
});
