// The one history model for the phone layout: the open note is a history entry carrying
// { notesPane: "note", noteId } next to whatever the Next.js router keeps in history.state.
// Back from that entry returns to the list; Forward onto it reopens the note.

export type NoteEntry = { notesPane: "note"; noteId: string };
/** What the page should show after landing on an entry. */
export type Landing = { show: "note"; noteId: string } | { show: "list" } | null;

type HistoryLike = Pick<History, "state" | "pushState" | "replaceState" | "back" | "forward">;
// Whether an entry exists after the current one (Navigation API navigation.canGoForward), or
// undefined where the browser cannot tell.
type CanGoForward = () => boolean | undefined;

export function entryNoteId(state: unknown): string {
  const entry = state as { notesPane?: unknown; noteId?: unknown } | null;
  return entry?.notesPane === "note" && typeof entry.noteId === "string" ? entry.noteId : "";
}

export function createNotesHistory(history: HistoryLike, canGoForward: CanGoForward = () => undefined) {
  // True while the current entry is our note entry.
  let inEntry = false;
  // history.back() is asynchronous: until its popstate arrives the old entry is still current, so a
  // note opened meanwhile is queued and recorded once Back has landed.
  let pendingBack = false;
  let queued = "";
  // A Forward past a deleted note's entry is in flight (see land).
  let skipping = false;
  // Still on a deleted note's entry after a Forward the browser could not confirm (no Navigation
  // API): if that Forward never lands, the next note replaces this dead entry instead of stacking
  // above it, or Back from that note would land on the dead entry and bounce forward onto it again.
  let onDeadEntry = false;
  function stepBack() {
    inEntry = false;
    pendingBack = true;
    history.back();
  }

  function write(noteId: string) {
    const state: Record<string, unknown> = { ...(history.state && typeof history.state === "object" ? history.state : {}), notesPane: "note", noteId };
    if (inEntry || onDeadEntry) history.replaceState(state, "");
    else history.pushState({ notesPane: "note", noteId }, "");
    inEntry = true;
    onDeadEntry = false;
  }

  return {
    get inEntry() { return inEntry; },
    /** Make noteId the current note entry: add one, or retarget the one already there. */
    record(noteId: string) {
      if (pendingBack || skipping) queued = noteId;
      else write(noteId);
    },
    /** The editor closed outside history (Delete, note gone): step off its entry. */
    drop() {
      // The editor closed: a note queued behind a pending Back is no longer shown, so forget it.
      queued = "";
      if (!inEntry) return;
      stepBack();
    },
    /**
     * Landed on an entry (popstate, or the current entry on mount after a reload). Returns what to
     * show, or null when the page already shows the right pane.
     */
    land(state: unknown, exists: (noteId: string) => boolean, initial = false): Landing {
      // Any landing means the earlier Forward did move on.
      onDeadEntry = false;
      if (pendingBack) {
        // Our own drop() finished: the list is already shown; record a note opened meanwhile.
        pendingBack = false;
        const next = queued;
        queued = "";
        if (next) write(next);
        return null;
      }
      let next = "";
      if (skipping) {
        // The Forward past a deleted note's entry landed on a further entry of this page: handle it
        // like any landing (a note opened meanwhile goes on top unless that entry opens a note).
        skipping = false;
        next = queued;
        queued = "";
      }
      const landing = landOn(state, exists, initial);
      if (next && landing?.show !== "note") {
        write(next);
        return null;
      }
      return landing;
    },
  };

  function landOn(state: unknown, exists: (noteId: string) => boolean, initial: boolean): Landing {
    const noteId = entryNoteId(state);
    if (noteId && exists(noteId)) {
      inEntry = true;
      return { show: "note", noteId };
    }
    if (noteId) {
      // The entry of a note deleted since. It always sits just above a list entry, so showing it as
      // the list would put two list stops in a row. Skip it in the direction of travel instead:
      // - a popstate onto it is a Forward (nothing of ours sits above it): keep going forward, so
      //   later pages stay reachable; when the browser says nothing is beyond, step back instead.
      // - on mount (a reload, or Back from another page) step back onto the list entry below.
      inEntry = false;
      queued = "";
      const beyond = canGoForward();
      if (initial || beyond === false) {
        stepBack();
      } else {
        // Hold new entries only while a Forward is known to be in flight: where the browser cannot
        // tell, a Forward from the last entry never lands and would hold them forever.
        skipping = beyond === true;
        onDeadEntry = beyond === undefined;
        history.forward();
      }
      return { show: "list" };
    }
    if (!inEntry) return null;
    inEntry = false;
    return { show: "list" };
  }
}
