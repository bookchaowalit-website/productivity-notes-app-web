# Field Notebook (notes app) — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `notes-app`) on 2026-10-23.

## What it is

A client-only plain-text notebook: a list of notes with search and one open note (title plus body), kept in this browser's localStorage.

## Who it is for

A portfolio visitor who wants a quiet scratch notebook in one browser.

## What works today

1. New leaf adds an untitled note on top and opens it; typing in the title or body saves at once and moves the note to the top (newest first).
2. Search title and body (case-insensitive). The newest note opens by default, also after a reload or a delete.
3. Remove the open note. Notes survive a reload; a saved value of the wrong shape is ignored, bad entries are dropped.
4. `/api/mcp` answers JSON-RPC `initialize` and `tools/list` with an empty tool list: notes stay in the visitor's browser, so any `tools/call` is refused with an error.
5. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No markdown or MDX, tags, pinned notes, offline mode beyond localStorage, or export to the blog pipeline (removed from the portfolio card in the 2026-10 review).
- No account or sync: notes stay in one browser on one device; clearing site data deletes them.

## Live URL and deploy state

- Live: https://notes-app.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-notes-app-frontend` is deployed only by CLI. Its last production deploy is the CVE patch (2026-10-23, CLI, commit 33672a8). Its Git link names the old repository `bookchaowalit/bookchaowalit-notes-app-frontend`, so a push to `main` does not deploy: the L2 work stays undeployed until the owner reconnects Vercel Git to this repository (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project `productivity-notes-app-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.

## Known limits

Phone history (`lib/notes-history.ts`): below 760px the open note is a history entry
(`{ notesPane: "note", noteId }` beside the Next.js router state), so Back returns to the list and
Forward reopens the note. These races are unlikely and left as they are (checked 2026-11-18):

- **Back that never lands.** Delete (or a note deleted in another tab) steps back with
  `history.back()`, which is asynchronous. A note opened before its `popstate` arrives is queued and
  recorded afterwards; if the browser drops that `popstate` (for example, the tab is frozen mid-step),
  the queued entry is never written and the next Back leaves the app instead of returning to the list.
- **Deleted note's entry.** It stays in the history (browsers cannot remove entries). Forward onto
  it shows the list and keeps going forward, so later pages stay reachable; when the browser reports
  nothing beyond it (`navigation.canGoForward`), the app steps back onto the list entry instead, so
  that Forward appears to do nothing. When the entry after a deleted note's entry belongs to another
  site, the Navigation API reports no forward entry for this document, so Forward to that site needs
  a second press. Browsers without the Navigation API cannot tell, so there a
  Forward onto the last entry stays on it and Back from it needs one extra press. A note opened
  while still on that dead entry replaces it (not stacked above it), so ‹ Notes from that note
  returns to the list instead of bouncing back onto the note.
- **User Back racing our Back.** If the user presses Back while the app's own `history.back()` is
  still pending, both steps run and the app may leave by one entry more than expected.
- **Other tabs.** History is per tab. A note deleted or created in another tab is seen through
  storage events, not history, so that tab's Back/Forward stops may point at notes that are gone
  (handled as the deleted note's entry above).
- **Breakpoint flips during a pending Back.** Crossing the 760px breakpoint while a Back is pending
  keeps the pane that holds focus, but its entry is written only once the Back lands.
