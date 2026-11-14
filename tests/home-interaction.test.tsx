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

  it("opening a note and going back switches the phone panes", () => {
    act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
    act(() => { button("‹ Notes").click(); });
    expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
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
    expect(document.activeElement?.textContent).toContain("New note");
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
