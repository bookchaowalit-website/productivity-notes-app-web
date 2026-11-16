import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }) }));

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
