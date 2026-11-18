import { describe, expect, it, vi } from "vitest";
import { createNotesHistory, entryNoteId } from "@/lib/notes-history";

function fakeHistory(state: unknown = null) {
  const h = {
    state,
    pushState: vi.fn((next: unknown) => { h.state = next; }),
    replaceState: vi.fn((next: unknown) => { h.state = next; }),
    back: vi.fn(),
    forward: vi.fn(),
  };
  return h;
}
const all = () => true;
const none = () => false;

describe("entryNoteId", () => {
  it("reads only our note entries", () => {
    expect(entryNoteId({ notesPane: "note", noteId: "a" })).toBe("a");
    expect(entryNoteId({ notesPane: "list", noteId: "a" })).toBe("");
    expect(entryNoteId({ notesPane: "note", noteId: 3 })).toBe("");
    expect(entryNoteId(null)).toBe("");
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

  it("land: a live note entry opens it; a deleted one steps back off it; foreign entries are ignored", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    expect(nav.land({ notesPane: "note", noteId: "a" }, all)).toEqual({ show: "note", noteId: "a" });
    expect(nav.land(null, all)).toEqual({ show: "list" });
    expect(nav.land(null, all)).toBeNull();
    // On mount (reload / Back from another page) a deleted note's entry steps back onto the list
    // entry below: no second list entry, state untouched.
    expect(nav.land({ __NA: true, notesPane: "note", noteId: "gone" }, none, true)).toEqual({ show: "list" });
    expect(h.replaceState).not.toHaveBeenCalled();
    expect(h.back).toHaveBeenCalledTimes(1);
    expect(h.forward).not.toHaveBeenCalled();
    expect(nav.inEntry).toBe(false);
    // That Back's popstate is ours: nothing else to show.
    expect(nav.land(null, all)).toBeNull();
  });

  it("a note opened while bouncing off a deleted note's entry is written once the bounce lands", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.land({ notesPane: "note", noteId: "gone" }, none, true);
    nav.record("b");
    expect(h.pushState).not.toHaveBeenCalled();
    nav.land(null, all);
    expect(h.pushState).toHaveBeenCalledWith({ notesPane: "note", noteId: "b" }, "");
  });

  it("closing the editor before the pending Back lands cancels the queued entry", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.record("a");
    nav.drop();
    nav.record("b");
    nav.drop();
    expect(h.back).toHaveBeenCalledTimes(1);
    expect(nav.land(null, all)).toBeNull();
    expect(h.pushState).toHaveBeenCalledTimes(1);
    expect(nav.inEntry).toBe(false);
  });
});

describe("Forward onto a deleted note's entry", () => {
  it("keeps going forward, so a later page stays reachable, and lands normally", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History, () => true);
    expect(nav.land({ notesPane: "note", noteId: "gone" }, none)).toEqual({ show: "list" });
    expect(h.forward).toHaveBeenCalledTimes(1);
    expect(h.back).not.toHaveBeenCalled();
    // A further entry of this page lands (here a foreign entry): handled normally.
    expect(nav.land(null, all)).toBeNull();
    expect(h.back).not.toHaveBeenCalled();
  });

  it("forwards too where the browser cannot tell what is beyond", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History);
    nav.land({ notesPane: "note", noteId: "gone" }, none);
    expect(h.forward).toHaveBeenCalledTimes(1);
    expect(h.back).not.toHaveBeenCalled();
    // That Forward may never land (last entry), so a note opened next is recorded at once.
    nav.record("b");
    expect(h.pushState).toHaveBeenCalledWith({ notesPane: "note", noteId: "b" }, "");
  });

  it("with nothing beyond, steps back onto the list entry (no two list stops in a row)", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History, () => false);
    nav.land({ notesPane: "note", noteId: "gone" }, none);
    expect(h.forward).not.toHaveBeenCalled();
    expect(h.back).toHaveBeenCalledTimes(1);
    nav.record("b");
    expect(h.pushState).not.toHaveBeenCalled();
    expect(nav.land(null, all)).toBeNull();
    expect(h.pushState).toHaveBeenCalledWith({ notesPane: "note", noteId: "b" }, "");
  });

  it("a note opened during the skip goes on top of where Forward landed, unless that opens a note", () => {
    const h = fakeHistory();
    const nav = createNotesHistory(h as unknown as History, () => true);
    nav.land({ notesPane: "note", noteId: "gone" }, none);
    nav.record("b");
    expect(h.pushState).not.toHaveBeenCalled();
    expect(nav.land(null, all)).toBeNull();
    expect(h.pushState).toHaveBeenCalledWith({ notesPane: "note", noteId: "b" }, "");
    nav.drop();
    nav.land(null, all);
    nav.land({ notesPane: "note", noteId: "gone" }, none);
    nav.record("c");
    expect(nav.land({ notesPane: "note", noteId: "a" }, all)).toEqual({ show: "note", noteId: "a" });
    expect(h.pushState).toHaveBeenCalledTimes(1);
  });
});
