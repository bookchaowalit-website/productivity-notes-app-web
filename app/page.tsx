"use client";

import { useState, useSyncExternalStore } from "react";
import { createNote, dateLabel, noteCount, deleteNote, filterNotes, leafNumber, noteStore, pickActive, updateNote, type Note } from "@/lib/notes";

const noop = () => () => {};

export default function Home() {
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.getSnapshot, noteStore.getServerSnapshot);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const active = pickActive(notes, activeId);
  const filtered = filterNotes(notes, query);

  const updateActive = (changes: Partial<Pick<Note, "title" | "body">>) => {
    if (!active) return;
    noteStore.update((current) => updateNote(current, active.id, changes, Date.now()));
  };

  const newLeaf = () => {
    const id = crypto.randomUUID();
    noteStore.update((current) => createNote(current, id, Date.now()));
    setActiveId(id);
  };

  const deleteActive = () => {
    if (!active) return;
    noteStore.update((current) => deleteNote(current, active.id));
    setActiveId("");
  };

  return (
    <main className="fieldbook-shell">
      <div className="fieldbook-frame">
        <header className="fieldbook-topbar">
          <a href="https://bookchaowalit.com" className="fieldbook-mark" aria-label="Bookchaowalit home"><span>BOOK</span> / FIELD</a>
          <span>ONE BROWSER / MANY LEAVES</span>
          <span>{ready ? noteCount(notes.length) : "OPENING NOTEBOOK"}</span>
        </header>

        <section className="fieldbook-intro">
          <div>
            <h1>Leave a mark.<br /><em>Find it later.</em></h1>
            <p>A quiet notebook for short thoughts, rough edges, and the sentence that should not disappear between tabs.</p>
          </div>
          <div className="fieldbook-swatch" aria-hidden="true"><span>LOCAL</span><b>01</b><span>NO SYNC</span></div>
        </section>

        <section className="notebook" aria-label="Local notes notebook">
          <aside className="note-index">
            <div className="index-title"><span>INDEX</span><span>{filtered.length} FOUND</span></div>
            <div className="index-actions"><button type="button" onClick={newLeaf}>+ New leaf</button><label><span className="sr-only">Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leaves" /></label></div>
            <div className="note-list">
              {filtered.length ? filtered.map((note, index) => (
                <button type="button" key={note.id} className={`note-row${active?.id === note.id ? " active" : ""}`} onClick={() => setActiveId(note.id)} aria-pressed={active?.id === note.id}>
                  <span className="note-tab">{String(index + 1).padStart(2, "0")}</span><span className="note-row-copy"><strong>{note.title || "Untitled note"}</strong><small>{dateLabel(note.updatedAt)}</small></span>
                </button>
              )) : <p className="empty-notes">No leaf matches this search.</p>}
            </div>
          </aside>

          <section className="note-sheet">
            {active ? <>
              <div className="sheet-bar"><span>LEAF / {String(leafNumber(notes, active.id)).padStart(2, "0")}</span><span>{dateLabel(active.updatedAt)}</span></div>
              <div className="sheet-content">
                <label className="title-field"><span className="sr-only">Note title</span><input value={active.title} onChange={(event) => updateActive({ title: event.target.value })} placeholder="Untitled note" /></label>
                <label className="body-field"><span className="sr-only">Note body</span><textarea value={active.body} onChange={(event) => updateActive({ body: event.target.value })} placeholder="Write the next line…" /></label>
                <div className="sheet-foot"><span>PLAIN TEXT / LOCAL STORAGE</span><button type="button" onClick={deleteActive}>Remove this leaf</button></div>
              </div>
            </> : <div className="no-note"><span className="no-note-mark">∷</span><p>Select a leaf or make a new one.</p><button type="button" onClick={newLeaf}>Open a new leaf</button></div>}
          </section>
        </section>

        <footer className="fieldbook-footer"><span>BOOK / DEV TOOLS</span><span>YOUR NOTES STAY ON THIS ORIGIN</span></footer>
      </div>
    </main>
  );
}
