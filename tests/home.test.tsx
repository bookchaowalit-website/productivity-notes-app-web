import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page (server render)", () => {
  const html = renderToString(<Home />);

  it("renders the notes list and the welcome note on the App shell with plain words", () => {
    expect(html).toContain('class="as"');
    expect(html).toContain("Welcome");
    expect(html).toContain("This note lives in localStorage.");
    expect(html).toContain("Saved in this browser · no sync");
    expect(html).not.toMatch(/leaf|LEAF/);
  });

  it("prints no locale-dependent date before the browser has loaded", () => {
    expect(html).not.toContain("Sample note");
    expect(html).toContain("<h2>Notes</h2>");
  });
});

describe("structure (review 2026-11-18)", () => {
  const html = renderToString(<Home />);
  it("has exactly one h1, the app name, before the note count h2", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 class="as-brand">Notes<small>/);
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<h2"));
  });
  it("the footer names a different page than the top bar's Bookchaowalit link", () => {
    expect(html).toContain('<a href="https://bookchaowalit.com/">Bookchaowalit</a>');
    expect(html).toContain('<a href="https://bookchaowalit.com/projects">More projects</a>');
  });
});
