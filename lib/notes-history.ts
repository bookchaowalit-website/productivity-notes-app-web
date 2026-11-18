// The one history model for the phone layout: the open note is a history entry carrying
// { notesPane: "note", noteId } next to whatever the Next.js router keeps in history.state.
// Back from that entry returns to the list; Forward onto it reopens the note.

export type NoteEntry = { notesPane: "note"; noteId: string };
/** What the page should show after landing on an entry. */
export type Landing = { show: "note"; noteId: string } | { show: "list" } | null;

type HistoryLike = Pick<History, "state" | "pushState" | "replaceState" | "back">;

export function entryNoteId(state: unknown): string {
  const entry = state as { notesPane?: unknown; noteId?: unknown } | null;
  return entry?.notesPane === "note" && typeof entry.noteId === "string" ? entry.noteId : "";
}

/** The state with our note fields cleared and everything else (router state) kept. */
export function withoutNote(state: unknown): Record<string, unknown> {
  return { ...(state && typeof state === "object" ? state : {}), notesPane: undefined, noteId: undefined };
}

export function createNotesHistory(history: HistoryLike) {
  // True while the current entry is our note entry.
  let inEntry = false;
  // history.back() is asynchronous: until its popstate arrives the old entry is still current, so a
  // note opened meanwhile is queued and recorded once Back has landed.
  let pendingBack = false;
  let queued = "";

  function write(noteId: string) {
    const state: Record<string, unknown> = { ...(history.state && typeof history.state === "object" ? history.state : {}), notesPane: "note", noteId };
    if (inEntry) history.replaceState(state, "");
    else history.pushState({ notesPane: "note", noteId }, "");
    inEntry = true;
  }

  return {
    get inEntry() { return inEntry; },
    /** Make noteId the current note entry: add one, or retarget the one already there. */
    record(noteId: string) {
      if (pendingBack) queued = noteId;
      else write(noteId);
    },
    /** The editor closed outside history (Delete, note gone): step off its entry. */
    drop() {
      // The editor closed: a note queued behind a pending Back is no longer shown, so forget it.
      queued = "";
      if (!inEntry) return;
      inEntry = false;
      pendingBack = true;
      history.back();
    },
    /**
     * Landed on an entry (popstate, or the current entry on mount after a reload). Returns what to
     * show, or null when the page already shows the right pane.
     */
    land(state: unknown, exists: (noteId: string) => boolean): Landing {
      if (pendingBack) {
        // Our own drop() finished: the list is already shown; record a note opened meanwhile.
        pendingBack = false;
        const next = queued;
        queued = "";
        if (next) write(next);
        return null;
      }
      const noteId = entryNoteId(state);
      if (noteId && exists(noteId)) {
        inEntry = true;
        return { show: "note", noteId };
      }
      if (noteId) {
        // The entry of a note deleted since: turn it into a list entry, keeping the router state.
        history.replaceState(withoutNote(state), "");
      } else if (!inEntry) {
        return null;
      }
      inEntry = false;
      return { show: "list" };
    },
  };
}
