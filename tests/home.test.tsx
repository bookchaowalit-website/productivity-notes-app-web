import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the notebook with the welcome leaf and the local-only notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Leave a mark.");
    expect(html).toContain("Welcome");
    expect(html).toContain("This note lives in localStorage.");
    expect(html).toContain("PLAIN TEXT / LOCAL STORAGE");
    expect(html).toContain("YOUR NOTES STAY ON THIS ORIGIN");
  });

  it("says the notebook is opening until the browser has loaded it", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("OPENING NOTEBOOK");
    expect(html).toMatch(/LEAF \/ (<!-- -->)?01/);
  });
});
