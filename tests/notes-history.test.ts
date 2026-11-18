import { describe, expect, it, vi } from "vitest";
import { createNotesHistory, entryNoteId, withoutNote } from "@/lib/notes-history";

function fakeHistory(state: unknown = null) {
  const h = {
    state,
    pushState: vi.fn((next: unknown) => { h.state = next; }),
    replaceState: vi.fn((next: unknown) => { h.state = next; }),
    back: vi.fn(),
  };
  return h;
}
const all = () => true;
const none = () => false;

describe("entryNoteId / withoutNote", () => {
  it("reads only our note entries", () => {
    expect(entryNoteId({ notesPane: "note", noteId: "a" })).toBe("a");
    expect(entryNoteId({ notesPane: "list", noteId: "a" })).toBe("");
    expect(entryNoteId({ notesPane: "note", noteId: 3 })).toBe("");
    expect(entryNoteId(null)).toBe("");
  });
  it("clears our fields and keeps the rest", () => {
    expect(withoutNote({ __NA: true, notesPane: "note", noteId: "a" })).toEqual({ __NA: true, notesPane: undefined, noteId: undefined });
    expect(withoutNote(null)).toEqual({ notesPane: undefined, noteId: undefined });
  });
});

describe("createNotesHistory", () => {
  it("record pushes once, then retargets the same entry keeping router state", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.record("a");
    expect(h.pushState).toHaveBeenCalledWith({ notesPane: "note", noteId: "a" }, "");
    h.state = { __NA: true, notesPane: "note", noteId: "a" };
    nav.record("b");
    expect(h.pushState).toHaveBeenCalledTimes(1);
    expect(h.replaceState).toHaveBeenCalledWith({ __NA: true, notesPane: "note", noteId: "b" }, "");
    expect(nav.inEntry).toBe(true);
  });

  it("drop steps back once; a record before popstate is queued until it lands", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.drop();
    expect(h.back).not.toHaveBeenCalled();
    nav.record("a");
    nav.drop();
    expect(h.back).toHaveBeenCalledTimes(1);
    nav.record("b");
    expect(h.pushState).toHaveBeenCalledTimes(1);
    expect(nav.land(null, all)).toBeNull();
    expect(h.pushState).toHaveBeenLastCalledWith({ notesPane: "note", noteId: "b" }, "");
    expect(nav.inEntry).toBe(true);
  });

  it("drop's popstate with nothing queued changes nothing", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.record("a");
    nav.drop();
    expect(nav.land(null, all)).toBeNull();
    expect(h.pushState).toHaveBeenCalledTimes(1);
    expect(nav.inEntry).toBe(false);
  });

  it("land: a live note entry opens it; a deleted one becomes a list entry; foreign entries are ignored", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    expect(nav.land({ notesPane: "note", noteId: "a" }, all)).toEqual({ show: "note", noteId: "a" });
    expect(nav.land(null, all)).toEqual({ show: "list" });
    expect(nav.land(null, all)).toBeNull();
    expect(nav.land({ __NA: true, notesPane: "note", noteId: "gone" }, none)).toEqual({ show: "list" });
    expect(h.replaceState).toHaveBeenCalledWith({ __NA: true, notesPane: undefined, noteId: undefined }, "");
  });
});
