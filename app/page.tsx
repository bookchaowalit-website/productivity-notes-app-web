"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppFoot, AppTop, PlusIcon } from "@/components/app-shell";
import { createNote, dateLabel, deleteNote, filterNotes, noteCount, noteStore, pickActive, previewOf, restoreNote, updateNote, type Note } from "@/lib/notes";

const noop = () => () => {};
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

  const active = pickActive(notes, activeId);
  // The open note can vanish under us (deleted in another tab). Go back to the list for real, so a
  // note created later in another tab does not suddenly open over the list the user is searching.
  if (!active && view === "note") setView("list");
  const filtered = filterNotes(notes, query);
  const when = (timestamp: number) => (ready ? dateLabel(timestamp) : "");

  useEffect(() => {
    if (!focusTitleNext.current) return;
    focusTitleNext.current = false;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [activeId]);
  useEffect(() => { if (removed.length) undoRef.current?.focus(); }, [removed]);
  useEffect(() => {
    const target = focusAfterView.current;
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
    setView("note");
    setAnnouncement("New note created.");
  }
  function open(id: string) {
    setActiveId(id);
    if (view !== "note") focusAfterView.current = "title";
    setView("note");
  }
  function back() {
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
    setView("note");
    setRemoved([]);
    setToastFocused(false);
    setAnnouncement(batch.length === 1 ? `Restored “${note.title || "Untitled note"}”.` : `Restored ${batch.length} notes.`);
  }

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Notes" tagline="Saved in this browser · no sync" />

      {/* With no note open (e.g. the last one was deleted in another tab) phones fall back to the list,
          which always has New note; otherwise the empty pane would have no way back. */}
      {/* The skip target wraps both panes: on phones one of them is display:none, so <main> alone could be hidden. */}
      <div id="main" tabIndex={-1} className="as-body as-notes" data-view={active ? view : "list"}>
        <aside className="as-side as-note-list" aria-label="Notes">
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

        <main className="as-main as-note-pane">
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
        </main>
      </div>

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
