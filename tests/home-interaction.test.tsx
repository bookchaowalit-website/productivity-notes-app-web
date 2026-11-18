// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { noteStore, SEED_NOTES } from "@/lib/notes";

// Mounted tests for notes on the App shell: list, search, new, edit, delete, undo, phone panes.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const titles = () => [...host.querySelectorAll(".as-note-row strong")].map((s) => s.textContent);
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const stored = () => JSON.parse(localStorage.getItem("notes-app-v1") ?? "[]") as { title: string; body: string }[];

beforeEach(() => {
  localStorage.clear();
  noteStore.update(() => SEED_NOTES);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("notes", () => {
  it("shows the count and the welcome note open after loading", () => {
    expect($(".as-note-list-head h2")!.textContent).toBe("1 note");
    expect($<HTMLInputElement>("#note-title")!.value).toBe("Welcome");
    expect($(".as-editor-meta")!.textContent).toBe("Not edited yet");
  });

  it("New note opens it on top with the title selected, and edits save to storage", () => {
    act(() => { button("New note").click(); });
    expect(titles()[0]).toBe("Untitled note");
    expect(document.activeElement).toBe($("#note-title"));
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    type($<HTMLInputElement>("#note-title")!, "Groceries");
    type($<HTMLTextAreaElement>("#note-body")!, "\nMilk\nEggs");
    expect(stored()[0]).toMatchObject({ title: "Groceries", body: "\nMilk\nEggs" });
    expect($(".as-note-row span")!.textContent).toContain("Milk");
    expect($(".as-editor-meta")!.textContent).toMatch(/^Edited /);
  });

  it("search filters the list and has a no-match state", () => {
    act(() => { button("New note").click(); });
    type($<HTMLInputElement>("#note-title")!, "Groceries");
    type($<HTMLInputElement>(".as-search input")!, "welcome");
    expect(titles()).toEqual(["Welcome"]);
    type($<HTMLInputElement>(".as-search input")!, "zzz");
    expect(host.textContent).toContain("Nothing matches");
  });

  it("opening a note and going back switches the phone panes and moves focus with them", () => {
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    expect(document.activeElement).toBe($("#note-title"));
    // happy-dom applies no phone CSS, so mimic the pane being hidden by dropping focus first.
    act(() => { (document.activeElement as HTMLElement).blur(); });
    act(() => { button("‹ Notes").click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    expect(document.activeElement).toBe($('.as-note-row[aria-current="true"]'));
  });

  it("leaves focus alone when the focused element is still visible (wide screens)", () => {
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    expect(document.activeElement).toBe($("#note-title"));
    act(() => { button("‹ Notes").click(); });
    expect(document.activeElement).toBe($("#note-title"));
  });
});

describe("delete and undo", () => {
  it("Delete removes the note, focuses Undo, and Undo restores and reopens it", () => {
    act(() => { button("Delete").click(); });
    expect(titles()).toEqual([]);
    expect(host.textContent).toContain("No notes yet");
    expect(document.activeElement?.textContent).toBe("Undo");
    act(() => { button("Undo").click(); });
    expect(titles()).toEqual(["Welcome"]);
    expect($<HTMLInputElement>("#note-title")!.value).toBe("Welcome");
    // Phones show one pane: Undo must bring the editor back, not leave the list showing.
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    expect(document.activeElement).toBe($("#note-title"));
  });

  it("closing the toast while another note is open returns focus to that note, not the hidden list", () => {
    act(() => { button("New note").click(); });
    act(() => { button("Delete").click(); });
    expect(document.activeElement?.textContent).toBe("Undo");
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    act(() => { button("Undo").click(); });
    expect(titles()).toHaveLength(2);
    expect(document.activeElement).toBe($("#note-title"));
  });

  it("Escape dismisses; the toast stays while focused and closes six seconds after focus leaves", () => {
    act(() => { button("Delete").click(); });
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
    expect(stored()).toEqual([]);

    act(() => { button("New note").click(); });
    vi.useFakeTimers();
    act(() => { button("Delete").click(); });
    act(() => { vi.advanceTimersByTime(7000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("New note").focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect($(".as-toast")).toBeNull();
  });
});

describe("review fixes", () => {
  it("falls back to the list pane when the open note disappears (deleted in another tab)", () => {
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    act(() => { noteStore.update(() => []); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    expect(host.textContent).toContain("No notes yet");
  });

  it("the skip link target holds both panes, so it is visible on phones in list view too", () => {
    const target = document.getElementById("main")!;
    expect($(".as-skip")!.getAttribute("href")).toBe("#main");
    expect(target.classList.contains("as-notes")).toBe(true);
    expect(target.tabIndex).toBe(-1);
    expect(target.contains($(".as-note-list"))).toBe(true);
    expect(target.contains($(".as-note-pane"))).toBe(true);
  });

  it("two deletes inside the Undo window are one batch: Undo restores both, and the timer restarts", () => {
    vi.useFakeTimers();
    act(() => { button("New note").click(); });
    type($<HTMLInputElement>("#note-title")!, "Groceries");
    act(() => { button("Delete").click(); });
    expect($(".as-toast span")!.textContent).toBe("Deleted “Groceries”");
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { (document.activeElement as HTMLElement).blur(); });
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    act(() => { button("Delete").click(); });
    expect(titles()).toEqual([]);
    expect($(".as-toast span")!.textContent).toBe("Deleted 2 notes");
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Deleted 2 notes");
    const undo = button("Undo");
    expect(undo.getAttribute("aria-label")).toMatch(/^Undo/);
    expect(undo.getAttribute("aria-label")).toBe("Undo delete of 2 notes");
    // 4 s after the first delete plus 4 s after the second: still open, because the second restarted it.
    act(() => { undo.blur(); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect($(".as-toast")).not.toBeNull();
    act(() => { button("Undo").click(); });
    expect(titles().sort()).toEqual(["Groceries", "Welcome"]);
    expect(stored().map((n) => n.title).sort()).toEqual(["Groceries", "Welcome"]);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Restored 2 notes.");
  });

  it("Undo restores the version that was deleted, including an edit saved by another tab", () => {
    // Another tab edits the note in storage; this tab has not re-rendered yet when Delete is pressed.
    localStorage.setItem("notes-app-v1", JSON.stringify([{ ...SEED_NOTES[0], body: "Edited elsewhere", updatedAt: 5 }]));
    act(() => { button("Delete").click(); });
    act(() => { button("Undo").click(); });
    expect(stored()[0]).toMatchObject({ title: "Welcome", body: "Edited elsewhere", updatedAt: 5 });
    expect($<HTMLTextAreaElement>("#note-body")!.value).toBe("Edited elsewhere");
  });

  it("stays on the list when another tab empties the notes and later creates one", () => {
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    act(() => { noteStore.update(() => []); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    act(() => { noteStore.update(() => [{ id: "x", title: "From another tab", body: "", updatedAt: 9 }]); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    expect(titles()).toEqual(["From another tab"]);
  });

  it("goes back to the list when another tab deletes the open note, even if other notes remain", () => {
    act(() => { button("New note").click(); });
    type($<HTMLInputElement>("#note-title")!, "Mine");
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    act(() => { noteStore.update((current) => current.filter((note) => note.title !== "Mine")); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    expect(titles()).toEqual(["Welcome"]);
  });

  it("the main landmark holds both the list and the editor; the editor is a section", () => {
    const main = host.querySelectorAll("main");
    expect(main).toHaveLength(1);
    expect(main[0].id).toBe("main");
    expect(main[0].contains($(".as-note-list"))).toBe(true);
    expect($(".as-note-pane")!.tagName).toBe("SECTION");
  });

  it("title and body each draw their own solid 3px focus ring", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/app/app-shell.css`, "utf8");
    expect(css).toContain(".as-editor-title:focus-visible, .as-editor-body:focus-visible { outline: 3px solid var(--as-focus); outline-offset: -3px; }");
    expect(css).not.toContain("color-mix(in srgb, var(--as-focus) 35%");
  });
});
