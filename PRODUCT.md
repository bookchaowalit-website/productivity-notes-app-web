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
