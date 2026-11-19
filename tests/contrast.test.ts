import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the text pairs that pass 4.5:1 only by a small margin (review 2026-11-18): if someone darkens
// --as-bg or lightens --as-muted, CI fails instead of the page quietly dropping under WCAG 1.4.3.
const css = readFileSync(new URL("../app/app-shell.css", import.meta.url), "utf8");
const block = (source: string) => Object.fromEntries([...source.matchAll(/--as-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = block(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = { ...light, ...block(css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf(".as {"))) };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: [string, string][] = [["muted", "bg"], ["muted", "surface"], ["fg", "bg"], ["fg", "surface"], ["accent", "surface"], ["accent", "bg"], ["danger", "surface"], ["grey", "selected"]];

describe("App shell colour contrast", () => {
  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    for (const [fg, bg] of textPairs) {
      it(`${name}: --as-${fg} on --as-${bg} is at least 4.5:1`, () => {
        expect(theme[fg], `--as-${fg}`).toBeTruthy();
        expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`${name}: input edges (--as-field-line) reach 3:1 on the page and the card`, () => {
      expect(contrast(theme["field-line"], theme.surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(theme["field-line"], theme.bg)).toBeGreaterThanOrEqual(3);
    });
  }
});
