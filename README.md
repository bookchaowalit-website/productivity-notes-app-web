# Field Notebook (notes app)

A plain-text notebook kept in this browser: make a leaf, write, search, remove. Newest first; nothing leaves the browser.

Live: https://notes-app.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No markdown, tags, pinning, export, account or sync.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: note list and edit rules, saved-data parsing, local store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/notes.ts`: sorting, search, active-note fallback, leaf numbering, edits, saved-data parsing and the localStorage store.
- `lib/local-store.ts`: small localStorage store for `useSyncExternalStore` (hydration-safe, works when storage is blocked).
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint; `initialize` and an empty `tools/list`, every call refused.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
