// Notes: note list rules and the browser-local store. Pure apart from the store at the end.
import { browserStorage, createLocalStore } from "@/lib/local-store";

export type Note = { id: string; title: string; body: string; updatedAt: number };

export const STORAGE_KEY = "notes-app-v1";
export const SEED_NOTES: Note[] = [
  { id: "1", title: "Welcome", body: "This note lives in localStorage.\n\nPress New note when a thought arrives.", updatedAt: 0 },
];

/** Most recently edited first; ties keep their stored order. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Case-insensitive search over title and body, newest first. A blank query lists everything. */
export function filterNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase();
  return sortNotes(notes).filter((note) => !needle || `${note.title} ${note.body}`.toLowerCase().includes(needle));
}

/** The selected note, or the newest one when the selection is gone (deleted, or never set). */
export function pickActive(notes: Note[], activeId: string): Note | null {
  return notes.find((note) => note.id === activeId) ?? sortNotes(notes)[0] ?? null;
}

/** Leaf number as shown in the index (newest = 01), so the sheet and the list agree. */
export function leafNumber(notes: Note[], id: string): number {
  return sortNotes(notes).findIndex((note) => note.id === id) + 1;
}

export function createNote(notes: Note[], id: string, now: number): Note[] {
  return [{ id, title: "Untitled note", body: "", updatedAt: now }, ...notes];
}

export function updateNote(notes: Note[], id: string, changes: Partial<Pick<Note, "title" | "body">>, now: number): Note[] {
  return notes.map((note) => (note.id === id ? { ...note, ...changes, updatedAt: now } : note));
}

export function deleteNote(notes: Note[], id: string): Note[] {
  return notes.filter((note) => note.id !== id);
}

/** Undo a delete: put the note back unless it is already there (the list is sorted by edit time). */
export function restoreNote(notes: Note[], note: Note): Note[] {
  return notes.some((entry) => entry.id === note.id) ? notes : [...notes, note];
}

/** First non-empty line of the body, for the one-line preview under a title in the list. */
export function previewOf(body: string): string {
  // Stop at the first line with text: long pasted bodies are previewed on every keystroke.
  let start = 0;
  while (start <= body.length) {
    const end = body.indexOf("\n", start);
    const line = body.slice(start, end < 0 ? body.length : end).trim();
    if (line) return line;
    if (end < 0) break;
    start = end + 1;
  }
  return "No additional text";
}

export function noteCount(count: number): string {
  return `${count} ${count === 1 ? "note" : "notes"}`;
}

export function dateLabel(timestamp: number, locale?: string): string {
  return timestamp ? new Date(timestamp).toLocaleDateString(locale, { month: "short", day: "numeric" }) : "Not edited yet";
}

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.body === "string" && typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt);
}

/** Saved notes, or null when nothing usable is saved; entries of the wrong shape are dropped. */
export function parseNotes(raw: string | null): Note[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isNote) : null;
  } catch {
    return null;
  }
}

export const noteStore = createLocalStore<Note[]>({
  key: STORAGE_KEY,
  fallback: SEED_NOTES,
  parse: parseNotes,
  serialize: (notes) => JSON.stringify(notes),
  getStorage: browserStorage,
});
