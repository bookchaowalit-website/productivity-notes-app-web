"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppFoot, AppTop, PlusIcon } from "@/components/app-shell";
import { createNote, dateLabel, deleteNote, filterNotes, noteCount, noteStore, pickActive, previewOf, restoreNote, updateNote, type Note } from "@/lib/notes";

const noop = () => () => {};

export default function Home() {
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.getSnapshot, noteStore.getServerSnapshot);
  // Dates use the viewer's locale, so they appear only after hydration (no locale baked into the HTML).
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  // On phones one pane shows at a time: the list, or the open note with a back button.
  const [view, setView] = useState<"list" | "note">("list");
  const [removed, setRemoved] = useState<Note | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusTitleNext = useRef(false);

  const active = pickActive(notes, activeId);
  const filtered = filterNotes(notes, query);
  const when = (timestamp: number) => (ready ? dateLabel(timestamp) : "");

  useEffect(() => {
    if (!focusTitleNext.current) return;
    focusTitleNext.current = false;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [activeId]);
  useEffect(() => { if (removed) undoRef.current?.focus(); }, [removed]);
  // The toast closes after 6 s, but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
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
    setView("note");
  }
  function remove() {
    if (!active) return;
    noteStore.update((current) => deleteNote(current, active.id));
    setRemoved(active);
    setActiveId("");
    setView("list");
    setAnnouncement(`Deleted “${active.title || "Untitled note"}”. Undo is available for a few seconds.`);
  }
  function closeToast() {
    setRemoved(null);
    setToastFocused(false);
    newRef.current?.focus();
  }
  function undo() {
    if (!removed) return;
    const note = removed;
    noteStore.update((current) => restoreNote(current, note));
    setActiveId(note.id);
    setAnnouncement(`Restored “${note.title || "Untitled note"}”.`);
    closeToast();
  }

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Notes" tagline="Saved in this browser · no sync" />

      <div className="as-body as-notes" data-view={view}>
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

        <main id="main" className="as-main as-note-pane">
          {active ? (
            <article className="as-editor" aria-label="Note">
              <div className="as-editor-bar">
                <button type="button" className="as-plain as-back" onClick={() => setView("list")}>‹ Notes</button>
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
      {removed ? (
        <div
          className="as-toast"
          role="group"
          aria-label="Undo delete"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>Deleted “{removed.title || "Untitled note"}”</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/productivity-notes-app-web" />
    </div>
  );
}
