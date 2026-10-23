import { describe, expect, it } from "vitest";
import { SEED_NOTES, noteCount, createNote, dateLabel, deleteNote, filterNotes, leafNumber, parseNotes, pickActive, sortNotes, updateNote, type Note } from "@/lib/notes";

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
    expect(noteCount(1)).toBe("1 NOTE");
    expect(noteCount(0)).toBe("0 NOTES");
    expect(noteCount(2)).toBe("2 NOTES");
  });

  it("labels an untouched note as a new leaf", () => {
    expect(dateLabel(0)).toBe("NEW LEAF");
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
