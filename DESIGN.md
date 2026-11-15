# Notes — design

Since 2026-11-14 this app uses the shared App shell (`APP-SHELL.md`) in two panes like Notes:
list with search on the left, the open note on the right (one pane at a time on phones), and
Delete with Undo. The earlier "field book" theme below is kept for history.

---

---
name: Field Book
description: A single-browser notebook for leaving, finding, and editing short notes.
---

# Design System: Field Book

## Overview

Field Book is a local notebook, not a collaborative notes platform. The interface should feel like a marked leaf in a field book: find a note in the dark index, make a new leaf, write on paper, and remove it when it no longer matters. The localStorage boundary is part of the product truth and remains visible.

## Colors

- **Slate** `#202832`: notebook cover and page ground.
- **Deep slate** `#182028`: quiet structural contrast.
- **Paper** `#f2ecd9`: writing surface.
- **Yellow field mark** `#e6c762`: focus, new-leaf action, and active note marker.
- **Rust tab** `#d77557`: delete/action signal and index punctuation.
- **Blue graphite** `#8ab1bd`: secondary field notes.
- **Slate line** `#56616a`: index rules.

Yellow is the “mark this” signal; rust is reserved for removal or deliberate interruption.

## Typography

Geist Sans keeps note titles and writing controls approachable. Geist Mono is used for field labels, timestamps, the local-storage statement, and index metadata. The editor body remains plain sans so the surface stays usable for actual short notes.

## Layout

The first viewport establishes the field-book thesis, local boundary, search, and note index beside the active paper sheet. On mobile the index comes first and the paper editor follows, with controls remaining reachable and no horizontal overflow.

## Elevation & Depth

Depth comes from the slate cover surrounding the paper sheet, a lighter paper-soft edge, and ruled borders. There are no shadows or floating app cards; the active leaf marker and paper contrast are sufficient.

## Shapes

The notebook uses square paper and index surfaces. The yellow field mark and rust tab are small rectangular signals. Avoid rounded containers so the page reads as a physical working book rather than a chat/productivity template.

## Components

- **Note index:** search, note count, new-leaf control, selectable rows, and empty state.
- **Paper editor:** title input, body textarea, updated label, and delete action.
- **Local state:** a direct localStorage note with honest persistence copy and no remote account language.

## Do's and Don'ts

- Do make writing the primary action and keep the editor quiet.
- Do preserve localStorage behavior and state it clearly.
- Do use yellow for focus and rust for destructive action.
- Don't imply sync, backup, collaboration, or cloud access.
- Don't add a generic dashboard sidebar, rounded card grid, or decorative gradients.
