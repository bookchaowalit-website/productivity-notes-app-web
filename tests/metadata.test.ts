import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }), Noto_Sans_Thai: () => ({ variable: "font-noto-thai" }) }));

describe("page metadata", () => {
  // BOO-402: the description promised "markdown-ish body text"; the editor is plain text.
  it("describes the plain-text notebook in every description", async () => {
    const { metadata } = await import("../app/layout");
    const descriptions = [metadata.description, metadata.openGraph?.description, metadata.twitter?.description];
    for (const text of descriptions) {
      expect(text).toContain("Plain-text notes");
      expect(text).not.toMatch(/markdown/i);
    }
  });
});

describe("fonts", () => {
  it("puts the Thai fallback font variable on <html> next to Geist", async () => {
    const { default: RootLayout } = await import("../app/layout");
    const html = RootLayout({ children: null });
    expect(html.props.className).toBe("font-geist font-noto-thai");
  });
});
