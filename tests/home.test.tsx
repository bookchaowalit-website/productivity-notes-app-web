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
    expect(html).not.toContain("Not edited yet");
    expect(html).toContain("<h2>Notes</h2>");
  });
});
