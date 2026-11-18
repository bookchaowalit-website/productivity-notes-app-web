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
  // Each test starts on a plain (list) history entry.
  window.history.replaceState(null, "");
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

  it("on phones opening a note adds a history entry; browser Back and ‹ Notes return to the list", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    const push = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    try {
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      expect($(".as-notes")!.getAttribute("data-view")).toBe("note");
      expect(push).toHaveBeenCalledTimes(1);
      // Browser / Android Back.
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
      // A second note open pushes again; ‹ Notes goes through history too, so there is no stale entry.
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      expect(push).toHaveBeenCalledTimes(2);
      act(() => { button("‹ Notes").click(); });
      expect(back).toHaveBeenCalledTimes(1);
      expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
      // A popstate that is not ours (no entry pushed) changes nothing.
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
      expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    } finally {
      push.mockRestore();
      back.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("on wide screens opening a note adds no history entry", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const push = vi.spyOn(window.history, "pushState");
    try {
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      act(() => { button("‹ Notes").click(); });
      expect(push).not.toHaveBeenCalled();
      expect($(".as-notes")!.getAttribute("data-view")).toBe("list");
    } finally {
      push.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("the editor fields have 3:1 resting edges (card edge, lines above and below the title)", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(`${process.cwd()}/app/app-shell.css`, "utf8");
    expect(css).toContain(".as-editor { border-color: var(--as-field-line); }");
    expect(css).toContain(".as-editor-bar { border-bottom-color: var(--as-field-line); }");
    expect(css).toContain(".as-editor-title { border-bottom: 1px solid var(--as-field-line); }");
  });
});

describe("phone history follows the pane", () => {
  const view = () => $(".as-notes")!.getAttribute("data-view");
  const pop = (state: unknown) => act(() => { window.dispatchEvent(new PopStateEvent("popstate", { state })); });
  function phone() {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    // Back lands on the list entry before the note entry (no note state).
    const back = vi.spyOn(window.history, "back").mockImplementation(() => { window.dispatchEvent(new PopStateEvent("popstate", { state: null })); });
    return { push, replace, back, restore: () => { push.mockRestore(); replace.mockRestore(); back.mockRestore(); vi.unstubAllGlobals(); } };
  }

  it("the note entry carries the note id, and Forward onto it reopens that note with focus in the title", () => {
    const h = phone();
    try {
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      const entry = h.push.mock.calls[0][0] as { notesPane: string; noteId: string };
      expect(entry).toEqual({ notesPane: "note", noteId: noteStore.getSnapshot()[0].id });
      pop(null);
      expect(view()).toBe("list");
      act(() => { (document.activeElement as HTMLElement | null)?.blur(); });
      pop(entry);
      expect(view()).toBe("note");
      expect($<HTMLInputElement>("#note-title")!.value).toBe("Welcome");
      expect(document.activeElement).toBe($("#note-title"));
      // Back again returns to the list.
      pop(null);
      expect(view()).toBe("list");
    } finally {
      h.restore();
    }
  });

  it("Forward onto the entry of a note deleted since stays on the list and turns the entry into a list entry", () => {
    const h = phone();
    try {
      pop({ notesPane: "note", noteId: "gone" });
      expect(view()).toBe("list");
      expect(h.replace).toHaveBeenCalledWith({ notesPane: undefined, noteId: undefined }, "");
    } finally {
      h.restore();
    }
  });

  it("Delete from the open note drops its history entry, keeps Undo, and Undo adds a fresh entry", () => {
    const h = phone();
    try {
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      act(() => { button("Delete").click(); });
      expect(h.back).toHaveBeenCalledTimes(1);
      expect(view()).toBe("list");
      expect(document.activeElement?.textContent).toBe("Undo");
      act(() => { button("Undo").click(); });
      expect(view()).toBe("note");
      expect(h.push).toHaveBeenCalledTimes(2);
    } finally {
      h.restore();
    }
  });

  it("another tab deleting the open note also drops its history entry", () => {
    const h = phone();
    try {
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      act(() => { noteStore.update(() => []); });
      expect(view()).toBe("list");
      expect(h.back).toHaveBeenCalledTimes(1);
      // ‹ Notes on a later note uses history once, never a second stale back.
      act(() => { button("New note").click(); });
      act(() => { button("‹ Notes").click(); });
      expect(h.back).toHaveBeenCalledTimes(2);
      expect(view()).toBe("list");
    } finally {
      h.restore();
    }
  });
});

describe("history after reload and across the breakpoint", () => {
  const view = () => $(".as-notes")!.getAttribute("data-view");
  function remount() {
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Home />));
  }

  it("a reload on a note entry shows that note, and the next open does not stack a second entry", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    const id = noteStore.getSnapshot()[0].id;
    window.history.replaceState({ notesPane: "note", noteId: id }, "");
    const push = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => { window.dispatchEvent(new PopStateEvent("popstate", { state: null })); });
    try {
      act(() => { (document.activeElement as HTMLElement | null)?.blur(); });
      remount();
      expect(view()).toBe("note");
      expect($<HTMLInputElement>("#note-title")!.value).toBe("Welcome");
      // Restoring does not pull focus (no keyboard popping up on reload).
      expect(document.activeElement).not.toBe($("#note-title"));
      // History does not move while restoring.
      expect(back).not.toHaveBeenCalled();
      // ‹ Notes uses the restored entry: back to the list, no new entry pushed.
      act(() => { button("‹ Notes").click(); });
      expect(back).toHaveBeenCalledTimes(1);
      expect(view()).toBe("list");
      expect(push).not.toHaveBeenCalled();
    } finally {
      push.mockRestore();
      back.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("a reload on the entry of a note deleted since shows the list and clears the entry", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    window.history.replaceState({ notesPane: "note", noteId: "gone" }, "");
    try {
      remount();
      expect(view()).toBe("list");
      expect(window.history.state).toEqual({ notesPane: undefined, noteId: undefined });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("narrowing to the phone layout with a note open adds its history entry once", () => {
    let phone = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal("matchMedia", () => ({ get matches() { return phone; }, addEventListener: (_: string, cb: () => void) => listeners.push(cb), removeEventListener: () => {} }));
    const push = vi.spyOn(window.history, "pushState");
    try {
      remount();
      act(() => { $<HTMLButtonElement>(".as-note-row")!.click(); });
      expect(push).not.toHaveBeenCalled();
      phone = true;
      act(() => { listeners.forEach((cb) => cb()); });
      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0][0]).toEqual({ notesPane: "note", noteId: noteStore.getSnapshot()[0].id });
      // Another change event while the entry exists adds nothing.
      act(() => { listeners.forEach((cb) => cb()); });
      expect(push).toHaveBeenCalledTimes(1);
      // Back now returns to the list.
      act(() => { window.dispatchEvent(new PopStateEvent("popstate", { state: null })); });
      expect(view()).toBe("list");
    } finally {
      push.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("history stays put for skip link and wide-screen switches", () => {
  it("Skip to content focuses main without adding a history entry or changing the hash", () => {
    const push = vi.spyOn(window.history, "pushState");
    const before = window.location.hash;
    try {
      const link = $<HTMLAnchorElement>(".as-skip")!;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      act(() => { link.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe($("#main"));
      expect($("#main")!.getAttribute("tabindex")).toBe("-1");
      expect(window.location.hash).toBe(before);
      expect(push).not.toHaveBeenCalled();
    } finally {
      push.mockRestore();
    }
  });

  it("switching notes on a wide screen retargets the existing note entry, without a new one", () => {
    let phone = true;
    vi.stubGlobal("matchMedia", () => ({ get matches() { return phone; } }));
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    try {
      act(() => { button("New note").click(); });
      type($<HTMLInputElement>("#note-title")!, "B");
      const [b, a] = noteStore.getSnapshot();
      act(() => { (document.querySelectorAll<HTMLButtonElement>(".as-note-row")[1]).click(); });
      // Phone: New note pushed; opening A while the note entry exists retargets it.
      expect(push).toHaveBeenCalledTimes(1);
      expect(window.history.state).toEqual({ notesPane: "note", noteId: a.id });
      phone = false;
      act(() => { (document.querySelectorAll<HTMLButtonElement>(".as-note-row")[0]).click(); });
      expect(push).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenLastCalledWith({ notesPane: "note", noteId: b.id }, "");
      expect(window.history.state).toEqual({ notesPane: "note", noteId: b.id });
    } finally {
      push.mockRestore();
      replace.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("history: queued entry, router state, breakpoint keeps the edited note", () => {
  const view = () => $(".as-notes")!.getAttribute("data-view");
  function remount() {
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Home />));
  }

  it("a note opened before Delete's Back has landed is recorded only after popstate", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    const push = vi.spyOn(window.history, "pushState");
    // Back is asynchronous: hold its popstate until the test releases it.
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    try {
      act(() => { button("New note").click(); });
      type($<HTMLInputElement>("#note-title")!, "Doomed");
      expect(push).toHaveBeenCalledTimes(1);
      act(() => { button("Delete").click(); });
      expect(back).toHaveBeenCalledTimes(1);
      // Undo before Back lands: the editor opens, but no entry is written on top of the old one yet.
      act(() => { button("Undo").click(); });
      expect(view()).toBe("note");
      expect(push).toHaveBeenCalledTimes(1);
      act(() => { window.dispatchEvent(new PopStateEvent("popstate", { state: null })); });
      // Back landed on the list entry: the queued note entry goes on now, and the editor stays.
      expect(push).toHaveBeenCalledTimes(2);
      expect(view()).toBe("note");
      expect($<HTMLInputElement>("#note-title")!.value).toBe("Doomed");
    } finally {
      push.mockRestore();
      back.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("clearing a deleted note's entry keeps the router's state", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 760px)" }));
    window.history.replaceState({ __NA: true, notesPane: "note", noteId: "gone" }, "");
    try {
      remount();
      expect(view()).toBe("list");
      expect(window.history.state).toEqual({ __NA: true, notesPane: undefined, noteId: undefined });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("narrowing to phone while typing in the wide editor keeps that note open and adds its entry", () => {
    let phone = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal("matchMedia", () => ({ get matches() { return phone; }, addEventListener: (_: string, cb: () => void) => listeners.push(cb), removeEventListener: () => {} }));
    const push = vi.spyOn(window.history, "pushState");
    try {
      remount();
      // Wide: the first note shows in the editor without picking a row; the view is still "list".
      expect(view()).toBe("list");
      act(() => { $<HTMLTextAreaElement>("#note-body")!.focus(); });
      phone = true;
      act(() => { listeners.forEach((cb) => cb()); });
      expect(view()).toBe("note");
      expect(push).toHaveBeenCalledWith({ notesPane: "note", noteId: noteStore.getSnapshot()[0].id }, "");
      expect(document.activeElement).toBe($("#note-body"));
    } finally {
      push.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("narrowing to phone while just browsing the list stays on the list", () => {
    let phone = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal("matchMedia", () => ({ get matches() { return phone; }, addEventListener: (_: string, cb: () => void) => listeners.push(cb), removeEventListener: () => {} }));
    const push = vi.spyOn(window.history, "pushState");
    try {
      remount();
      act(() => { (document.activeElement as HTMLElement | null)?.blur(); });
      phone = true;
      act(() => { listeners.forEach((cb) => cb()); });
      expect(view()).toBe("list");
      expect(push).not.toHaveBeenCalled();
    } finally {
      push.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
