import { describe, expect, it } from "vitest";
import { SEED_NOTES, noteCount, previewOf, restoreNote, createNote, dateLabel, deleteNote, isoTime, filterNotes, leafNumber, parseNotes, pickActive, sortNotes, updateNote, type Note } from "@/lib/notes";

const note = (id: string, updatedAt: number, title = id, body = ""): Note => ({ id, title, body, updatedAt });
const notes = [note("a", 10, "Groceries", "milk"), note("b", 30, "Ideas", "Ship the MILK app"), note("c", 20, "Plan")];

describe("list rules", () => {
  it("sorts newest first without mutating the input", () => {
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["b", "c", "a"]);
    expect(notes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("searches title and body case-insensitively, trimmed, newest first", () => {
    expect(filterNotes(notes, "  milk ").map((n) => n.id)).toEqual(["b", "a"]);
    expect(filterNotes(notes, "")).toHaveLength(3);
    expect(filterNotes(notes, "zzz")).toEqual([]);
  });

  it("numbers the open leaf like the index does (newest = 1)", () => {
    expect(leafNumber(notes, "b")).toBe(1);
    expect(leafNumber(notes, "a")).toBe(3);
  });
});

describe("pickActive", () => {
  it("keeps the selected note", () => {
    expect(pickActive(notes, "c")?.id).toBe("c");
  });

  it("falls back to the newest note when the selection is gone, or null when empty", () => {
    expect(pickActive(notes, "")?.id).toBe("b");
    expect(pickActive([], "a")).toBeNull();
  });
});

describe("edits", () => {
  it("creates an untitled note on top", () => {
    expect(createNote(notes, "n", 99)[0]).toEqual({ id: "n", title: "Untitled note", body: "", updatedAt: 99 });
  });

  it("updates only the target note and stamps it", () => {
    const next = updateNote(notes, "a", { body: "eggs" }, 50);
    expect(next[0]).toEqual({ id: "a", title: "Groceries", body: "eggs", updatedAt: 50 });
    expect(next[1]).toBe(notes[1]);
  });

  it("deletes by id", () => {
    expect(deleteNote(notes, "b").map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("counts notes with the right plural", () => {
    expect(noteCount(1)).toBe("1 note");
    expect(noteCount(0)).toBe("0 notes");
    expect(noteCount(2)).toBe("2 notes");
  });

  it("labels an untouched note as a new leaf", () => {
    expect(dateLabel(0)).toBe("Sample note");
    expect(dateLabel(8.64e15 + 1)).toBe("Date unknown");
    expect(isoTime(8.64e15 + 1)).toBeUndefined();
    expect(isoTime(Date.UTC(2026, 9, 23))).toBe("2026-10-23T00:00:00.000Z");
    expect(dateLabel(Date.UTC(2026, 9, 23, 12), "en-US")).toBe("Oct 23");
  });
});

describe("parseNotes", () => {
  it("returns null for nothing saved, bad JSON or a non-array", () => {
    expect(parseNotes(null)).toBeNull();
    expect(parseNotes("{")).toBeNull();
    expect(parseNotes('{"id":"1"}')).toBeNull();
  });

  it("drops entries of the wrong shape instead of crashing the page", () => {
    const raw = JSON.stringify([SEED_NOTES[0], { id: "x", title: "No body", updatedAt: 1 }, { id: "y", title: "t", body: "b", updatedAt: "soon" }, null]);
    expect(parseNotes(raw)).toEqual(SEED_NOTES);
  });

  it("keeps an empty notebook (every note deleted)", () => {
    expect(parseNotes("[]")).toEqual([]);
  });
});

describe("App shell helpers", () => {
  const a: Note = { id: "a", title: "A", body: "\n  first line  \nsecond", updatedAt: 1 };
  it("previews the first non-empty body line", () => {
    expect(previewOf(a.body)).toBe("first line");
    expect(previewOf("   \n ")).toBe("No additional text");
    expect(previewOf("")).toBe("No additional text");
    expect(previewOf("\n\n  second  \nthird")).toBe("second");
    expect(previewOf("only")).toBe("only");
    const long = "word ".repeat(200);
    expect(previewOf(long).length).toBeLessThanOrEqual(81);
    expect(previewOf(long).endsWith("…")).toBe(true);
    expect(previewOf("x".repeat(80))).toBe("x".repeat(80));
  });
  it("restores a deleted note once", () => {
    expect(restoreNote([], a)).toEqual([a]);
    const list = [a];
    expect(restoreNote(list, a)).toBe(list);
  });
});
