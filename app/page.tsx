"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppFoot, AppTop, PlusIcon } from "@/components/app-shell";
import { createNotesHistory } from "@/lib/notes-history";
import { createNote, dateLabel, deleteNote, filterNotes, noteCount, noteStore, pickActive, previewOf, restoreNote, updateNote, type Note } from "@/lib/notes";

const noop = () => () => {};
// Matches the CSS breakpoint where only one pane shows.
const PHONE = "(max-width: 760px)";
const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia(PHONE).matches;
const deletedLabel = (batch: Note[]) => (batch.length === 1 ? `Deleted “${batch[0].title || "Untitled note"}”` : `Deleted ${batch.length} notes`);

export default function Home() {
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.getSnapshot, noteStore.getServerSnapshot);
  // Dates use the viewer's locale, so they appear only after hydration (no locale baked into the HTML).
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  // On phones one pane shows at a time: the list, or the open note with a back button.
  const [view, setView] = useState<"list" | "note">("list");
  // Every delete still inside the Undo window: one Undo puts them all back.
  const [removed, setRemovedState] = useState<Note[]>([]);
  // The latest batch, so two deletes before a re-render still both land in it.
  const removedRef = useRef<Note[]>([]);
  const setRemoved = (batch: Note[]) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusTitleNext = useRef(false);
  // On phones the pane that held focus is hidden when the view switches; move focus to the pane
  // now shown (the title when a note opens, that note's row when going back to the list).
  const focusAfterView = useRef<"title" | "row" | null>(null);
  const shownView = useRef<"list" | "note">("list");
  // On phones the open note is a history entry (lib/notes-history), so the browser or Android Back
  // returns to the list (and its search) instead of leaving the app, and Forward reopens that note.
  const nav = useRef<ReturnType<typeof createNotesHistory> | null>(null);
  // The note the editor shows (on wide screens one shows even before any row is picked).
  const shownNoteId = useRef("");
  const paneRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);

  const active = pickActive(notes, activeId);
  // The open note can vanish under us (deleted in another tab). Go back to the list for real, even
  // when other notes remain: otherwise the editor would quietly swap to another note under the
  // user's cursor (typing would land in the wrong note), or a note created later in another tab
  // would open over the list the user is searching.
  if (view === "note" && !notes.some((note) => note.id === activeId)) {
    setView("list");
  }
  const filtered = filterNotes(notes, query);
  const when = (timestamp: number) => (ready ? dateLabel(timestamp) : "");

  useEffect(() => {
    if (!focusTitleNext.current) return;
    focusTitleNext.current = false;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [activeId]);
  useEffect(() => { if (removed.length) undoRef.current?.focus(); }, [removed]);
  useEffect(() => { shownNoteId.current = active?.id ?? ""; }, [active]);
  useEffect(() => {
    const navigation = (window as { navigation?: { canGoForward?: boolean } }).navigation;
    const history = createNotesHistory(window.history, () => navigation?.canGoForward);
    nav.current = history;
    const exists = (noteId: string) => noteStore.getSnapshot().some((note) => note.id === noteId);
    // The entry we land on decides the pane: a note entry (Forward, or the current entry after a
    // reload) opens its note again; any other entry shows the list.
    // initial: the current entry on mount (reload, or arriving from another page), not a popstate.
    function showEntry(state: unknown, moveFocus: boolean, initial = false) {
      const landing = history.land(state, exists, initial);
      if (!landing) return;
      if (landing.show === "note") {
        if (moveFocus && shownView.current !== "note") focusAfterView.current = "title";
        setActiveId(landing.noteId);
        setView("note");
        return;
      }
      if (shownView.current === "list") return;
      focusAfterView.current = "row";
      setView("list");
    }
    const onPop = (event: PopStateEvent) => showEntry(event.state, true);
    // Reloaded on a note entry: show that note in place (no focus grab, no history move).
    showEntry(window.history.state, false, true);
    // Narrowed past the breakpoint (rotation, resize): only one pane stays, and the pane holding focus
    // decides which. Focus in the list (e.g. the search box) keeps the list; otherwise the note being
    // edited (focus in the editor, or the note pane shown) stays open with its entry, or Back would
    // leave the app.
    const media = typeof window.matchMedia === "function" ? window.matchMedia(PHONE) : null;
    const onMedia = () => {
      const noteId = shownNoteId.current;
      if (!isPhone()) return;
      if (listRef.current?.contains(document.activeElement)) {
        // Leaving the note view also drops its entry (the view effect).
        if (shownView.current === "note") setView("list");
        return;
      }
      const editing = shownView.current === "note" || Boolean(paneRef.current?.contains(document.activeElement));
      if (!noteId || !editing) return;
      if (!history.inEntry) history.record(noteId);
      setActiveId(noteId);
      setView("note");
    };
    window.addEventListener("popstate", onPop);
    media?.addEventListener?.("change", onMedia);
    return () => {
      window.removeEventListener("popstate", onPop);
      media?.removeEventListener?.("change", onMedia);
    };
  }, []);
  useEffect(() => {
    // The editor closed without going through history (Delete, or the open note was deleted in another
    // tab): drop its history entry too, so the next Back leaves the list instead of doing nothing.
    // Undo state is untouched; popstate then finds the list already shown. Only on a real editor →
    // list switch: on mount (a reload restoring a note entry) history must not move.
    const cameFromNote = shownView.current === "note";
    if (view === "list" && cameFromNote) nav.current?.drop();
    // A switch to the list that no handler asked for (the open note vanished) also lands on the list.
    shownView.current = view;
    const target = focusAfterView.current ?? (view === "list" && cameFromNote ? "row" : null);
    focusAfterView.current = null;
    // Only when focus was really lost: on wide screens both panes stay visible, so leave it alone.
    const current = document.activeElement as HTMLElement | null;
    if (current && current !== document.body && current.offsetParent !== null) return;
    if (target === "title") titleRef.current?.focus();
    if (target === "row") (document.querySelector<HTMLButtonElement>('.as-note-row[aria-current="true"]') ?? newRef.current)?.focus();
  }, [view]);
  // The toast closes 6 s after the latest delete (each delete restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed.length || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = []; setRemovedState([]); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  const updateActive = (changes: Partial<Pick<Note, "title" | "body">>) => {
    if (!active) return;
    noteStore.update((current) => updateNote(current, active.id, changes, Date.now()));
  };
  function newNote() {
    const id = crypto.randomUUID();
    noteStore.update((current) => createNote(current, id, Date.now()));
    setQuery("");
    focusTitleNext.current = true;
    setActiveId(id);
    showNote(id);
    setAnnouncement("New note created.");
  }
  function showNote(noteId: string) {
    // Wide screens add no entry, but an entry already there (made on a phone) follows the note shown.
    if (isPhone() || nav.current?.inEntry) nav.current?.record(noteId);
    setView("note");
  }
  function open(id: string) {
    setActiveId(id);
    if (view !== "note") focusAfterView.current = "title";
    showNote(id);
  }
  function back() {
    // ‹ Notes uses the same history entry as the browser Back (popstate below switches the pane).
    if (nav.current?.inEntry) {
      window.history.back();
      return;
    }
    focusAfterView.current = "row";
    setView("list");
  }
  function remove() {
    if (!active) return;
    // Keep the note as stored at the moment of deleting (another tab may have edited it since this
    // render), so Undo brings back exactly what was deleted.
    let deleted: Note | undefined;
    noteStore.update((current) => {
      deleted = current.find((note) => note.id === active.id);
      return deleteNote(current, active.id);
    });
    setActiveId("");
    setView("list");
    if (!deleted) return;
    const batch = [...removedRef.current, deleted];
    setRemoved(batch);
    setAnnouncement(`${deletedLabel(batch)}. Undo is available for a few seconds.`);
  }
  function closeToast() {
    setRemoved([]);
    setToastFocused(false);
    // On phones only one pane shows: with a note open the list (and New note) is display:none.
    (active && view === "note" ? titleRef : newRef).current?.focus();
  }
  function undo() {
    const batch = removedRef.current;
    if (!batch.length) return;
    const note = batch[batch.length - 1];
    noteStore.update((current) => batch.reduce(restoreNote, current));
    // Reopen the last one deleted: remove() switched phones to the list, so show the editor again and
    // put focus in the restored note's title (the activeId effect does that once it renders).
    focusTitleNext.current = true;
    setActiveId(note.id);
    showNote(note.id);
    setRemoved([]);
    setToastFocused(false);
    setAnnouncement(batch.length === 1 ? `Restored “${note.title || "Untitled note"}”.` : `Restored ${batch.length} notes.`);
  }

  return (
    <div className="as">
      {/* Focus <main> without following the #main hash: that would add a history entry above the note's. */}
      <a className="as-skip" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <AppTop name="Notes" tagline="Saved in this browser · no sync" />

      {/* With no note open (e.g. the last one was deleted in another tab) phones fall back to the list,
          which always has New note; otherwise the empty pane would have no way back. */}
      {/* The skip target wraps both panes: on phones one of them is display:none, so <main> alone could be hidden. */}
      <main id="main" tabIndex={-1} className="as-body as-notes" data-view={active ? view : "list"}>
        <aside ref={listRef} className="as-side as-note-list" aria-label="Notes">
          <div className="as-note-list-head">
            <h2>{ready ? noteCount(notes.length) : "Notes"}</h2>
            <button ref={newRef} type="button" className="as-button" onClick={newNote}><PlusIcon />New note</button>
          </div>
          <label className="as-search">
            <span className="as-sr">Search notes</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" autoComplete="off" />
          </label>
          <p className="as-sr" aria-live="polite">{query.trim() ? `${filtered.length} matching` : ""}</p>
          {filtered.length ? (
            <ul className="as-list as-list-links">
              {filtered.map((note) => (
                <li key={note.id}>
                  <button type="button" className="as-note-row" aria-current={active?.id === note.id ? "true" : undefined} onClick={() => open(note.id)}>
                    <strong>{note.title || "Untitled note"}</strong>
                    <span><time>{when(note.updatedAt)}</time>{ready ? "  " : ""}{previewOf(note.body)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {notes.length ? <><strong>Nothing matches</strong>No note mentions “{query.trim()}”.</> : <><strong>No notes yet</strong>Press New note to start one.</>}
            </div>
          )}
        </aside>

        <section ref={paneRef} className="as-main as-note-pane" aria-label="Note editor">
          {active ? (
            <article className="as-editor" aria-label="Note">
              <div className="as-editor-bar">
                <button type="button" className="as-plain as-back" onClick={back}>‹ Notes</button>
                <span className="as-editor-meta">{ready ? (active.updatedAt ? `Edited ${dateLabel(active.updatedAt)}` : dateLabel(0)) : ""}</span>
                <button type="button" className="as-plain as-danger" onClick={remove}>Delete</button>
              </div>
              <label className="as-sr" htmlFor="note-title">Note title</label>
              <input id="note-title" ref={titleRef} className="as-editor-title" value={active.title} onChange={(event) => updateActive({ title: event.target.value })} placeholder="Title" autoComplete="off" />
              <label className="as-sr" htmlFor="note-body">Note text</label>
              <textarea id="note-body" className="as-editor-body" value={active.body} onChange={(event) => updateActive({ body: event.target.value })} placeholder="Start writing" />
            </article>
          ) : (
            <div className="as-list as-empty as-editor-empty"><strong>No note open</strong>Pick a note from the list or press New note.</div>
          )}
          <p className="as-note">Plain text, saved in this browser only. Nothing is uploaded or synced.</p>
        </section>
      </main>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed.length ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo delete"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{deletedLabel(removed)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.length === 1 ? "Undo delete" : `Undo delete of ${removed.length} notes`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/productivity-notes-app-web" />
    </div>
  );
}
