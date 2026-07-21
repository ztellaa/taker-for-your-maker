# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Seetal Cornish CRM** is a wealth management CRM system designed for RBC advisors. It provides a visual mind map interface for managing contacts, accounts, and tasks (including logged contact touches). The application runs entirely in the browser, persisting to localStorage and, optionally, a user-chosen folder on disk.

## Architecture

### Module Loading Order

The application uses vanilla JavaScript with modules loaded via script tags in a specific dependency order (see index.html):

1. **config.js** - Configuration, templates, and color schemes
2. **utils.js** - Utility functions (date formatting, escaping, UUIDs, etc.)
3. **validation.js** - Field validation rules per template
4. **dom-refs.js** - Centralized DOM element references
5. **state.js** - Global application state (AppState namespace)
6. **undo.js** - Undo/redo functionality with state snapshots
7. **node-operations.js** - Node CRUD, tree traversal (BFS/DFS), and node scaffolding
8. **render.js** - Rendering logic for mind map, links, task list, and stats
9. **storage.js** - LocalStorage persistence and automatic backup system
10. **file-persistence.js** - Folder-backed persistence via the File System Access API (second, independent write path)
11. **analytics.js** - Weekly business development tracking
12. **touch-tracker.js** - Generic toast notification helper (name predates the Touch template removal in v14)
13. **editor.js** - Node editing modal and field management
14. **modals.js** - Backup, mailing list, CSV import, and backup-reminder modals
15. **events.js** - All event handlers (drag-and-drop, zoom, keyboard shortcuts, etc.)
16. **search-advanced.js** - Advanced search with field-specific queries
17. **main.js** - Initialization and orchestration

All modules expose their functionality through `window.*` namespaces (e.g., `window.Utils`, `window.AppState`, `window.NodeOps`).

### Core Data Structure

Nodes are tree-structured objects with this shape:
```javascript
{
  id: string,           // UUID
  title: string,
  template: string,     // 'Contact', 'Account', 'Task', 'Note', 'Sub-Tree'
  status: string,       // 'todo', 'inprogress', 'blocked', 'done', 'A-tier', 'B-tier', 'C-tier', 'Dormant'
  due: string,          // ISO date (YYYY-MM-DD)
  notes: string,
  fields: object,       // Template-specific fields
  freq: string,         // 'daily', 'monthly', 'quarterly', 'biannually', 'annually' (Contact defaults to 'daily')
  highlight: boolean,   // User flag for important nodes
  proxyHighlight: boolean, // Computed: collapsed node with highlighted descendants
  collapsed: boolean,
  color: string,        // Hex color
  colorIsCustom: boolean, // True once a Contact's Frame Color is manually set (opts out of "rotting")
  analyticsLogged: boolean, // Guards against double-counting Analytics when a Task is saved repeatedly
  lastTaskCompletedDate: string, // ISO date a child Task last completed successfully; drives the 2-day "just completed" green card background
  successful: boolean,  // Task only - true only via the "Success!" editor button, not the normal Save button
  completionCounted: boolean, // Guards against double-counting a Task's completion into lastTaskCompletedDate on repeat saves
  anchored: boolean,    // Reserved for future use
  children: array,
  pos: {x, y}          // Absolute coordinates in mind map
}
```

### Contact Creation

Creating a Contact node no longer auto-scaffolds any child container (the automatic "Tasks" Sub-Tree was removed in v14). New Contacts are created bare; Tasks are added directly under them via `C`/`+Child` or the `T` hotkey. New Contacts default to `freq: 'daily'` and `fields['Last Contact']` set to today (`node-operations.js:newNode()`) so they start "fresh"/green under rotting instead of immediately showing as most-rotten for having no contact on record. This applies uniformly to Contacts created via `P`, `+Child`, and CSV import (below), since all three go through `newNode()`.

### CSV Import

The **Import** toolbar button opens a modal (`js/modals.js`, `#importBackdrop` in `index.html`) for bulk-creating Contacts from pasted or uploaded CSV data. Column headers are matched case-insensitively and don't need to be in a fixed order: a `Name` column is split on the first space into First/Last Name; otherwise separate `First Name`/`Last Name` columns are used. `Email`, `Phone` (or `Cell`/`Cell Number`/`Phone Number`), and `Notes`/`Note` are also recognized; unrecognized columns are ignored. The modal shows a copyable example template and a preview before import. Each import run creates one new "CSV Import `<date>`" Sub-Tree under the currently selected node (or root if nothing is selected), and all imported Contacts are added under that Sub-Tree - keeping each batch visually grouped rather than dumped loose into the parent. Contacts get the same Daily/Last-Contact-today defaults as any other new Contact, since they're all created via `nodeOps.newNode()`.

### Template System

Templates define the data fields for each node type and optional custom display functions. See `config.js:Templates` for the full configuration.

Key templates:
- **Contact** - Unified relationship records (combines former Client/COI/Opportunity) with AUM tracking, contact schedules, Contact Frequency
- **Account** - Financial accounts (RRSP, TFSA, etc.)
- **Task** - Time-bound action items with status tracking, plus a `Channel` field (Call/LinkedIn/Email) used to log contact touches
- **Note** - Notes that roll up to parent Contact
- **Sub-Tree** - Organizational containers with hierarchical font sizing

### Task-based Touch Logging (v14)

The Touch template was removed in v14. Logging a contact touch is now just creating a Task:

1. Select a Contact (or a Sub-Tree under one) and press **T**
2. A new Task is created as a direct child, already `due` today and `status: 'done'`, and the editor opens so you can set its `Channel`
3. The Task is born `status: 'done'` but its completion side effects don't apply until the editor is actually saved (Save or Success! - see below) - `nodeOps.applyTaskCompletion(taskNode)` runs on any Task save where `status === 'done'`, not at creation, so a cancelled edit doesn't lock in a false "failure":
   - The parent Contact's `Last Contact` field is stamped to today - this is what drives "rotting" (see Rendering System below)
   - If a `Channel` is set and hasn't been logged yet, it's recorded once to the weekly Analytics BD tracker (`Analytics.recordTouch`), guarded by `node.analyticsLogged`
   - If the Task was marked successful (below), it also stamps `lastTaskCompletedDate` (the "just completed" green glow) - a non-successful completion has no Contact-level effect beyond the Last Contact stamp
   - There is **no** automatic follow-up Task creation and **no** note roll-up anymore - the rotting frame color is the only staleness signal now

Existing Touch nodes in older saved data are migrated on load (`storage.js:migrate()`, v14 block) into completed/todo Tasks with a `Channel` field, preserving their notes and due date.

### Task Success/Failure Tracking (v14.2)

The Task editor has two ways to complete a Task: **Save** (marks it done per the status dropdown, `node.successful` left `false`/untouched) and **Success!** (`#successBtn`, Task template only - forces `status: 'done'` and `node.successful = true`). Both funnel through the same `performSave(markSuccessful)` in `editor.js`. This distinction drives:
- **Task card color** - done + successful → green `.task-done` (unchanged from before); done + not successful → orange `.node.task-unsuccessful` (new). Field text (`.kv`) on both is forced black for contrast against these light-ish gradients.
- **Contact card background** - only a successful completion has any effect (triggers the "just completed" green glow via `lastTaskCompletedDate`). A non-successful completion does **not** change the Contact's background at all - v14.2 originally also shaded it toward red on a failure streak, but that was rolled back in v14.2.1 as a bug fix.

### Editor Title (v14.2.1)

`editor.js:openEditor(id)` sets `#editorTitle`'s text to `"Edit Node - " + node.title` when the modal opens (`dom.editorTitle`, added to `dom-refs.js`), instead of the static "Edit Node". Set once at open time, not live-updated as the Title field is edited.

### Note Roll-up

When a Note is saved, its content automatically rolls up to the parent Contact's notes field with a timestamp.

### Persistence

The application writes to two independent stores on every change (`storage.js:markDirty()`), so a failure in one doesn't lose data:
- **localStorage** - `wm.mindmap` (current state); fallback backup path only (see below)
- **A user-chosen folder on disk** (`js/file-persistence.js`, File System Access API - Chrome/Edge only) - debounced (~2s) writes to `crm-live-database.json` inside the chosen directory, plus rotating timestamped snapshots in a `backups/` subdirectory (see below). This was added in v14 after a company-wide Windows update silently broke `localStorage`-only autosave. The folder isn't picked automatically (browsers require a user gesture); click the **CRM Folder** toolbar button and choose the folder. The suggested default path is `window.AppConfig.CrmFolderHint` in `config.js`. The chosen folder handle is remembered across sessions via IndexedDB, re-prompting for permission if the browser requires it.

**The connected folder is the real backup mechanism (v14.2)** - `js/storage.js:snapshotBackup()` writes into the folder's `backups/` directory (`FilePersistence.snapshotToFolder()`, pruned to the newest 10) whenever one is connected; the localStorage `wm.backups` array is only used as a fallback when no folder is connected (it's capped at 10 full-map snapshots and can silently hit localStorage's quota on a large map - not a concern once a folder is connected). The **Backups** modal (`modals.js:rebuildBackupsUI()`) reads from whichever source is active. Reliability fixes in v14.2 that make this trustworthy:
- `scheduleWrite()`'s 2s debounce is flushed immediately (`FilePersistence.flushPending()`) on `visibilitychange`/`beforeunload` (wired in `main.js:initFilePersistence()`) so an edit followed by closing the tab isn't lost, mirroring the same triggers `initAutosave()` already used for localStorage.
- Connecting/reconnecting a folder writes the current state immediately instead of waiting for the next edit.
- A failed write sets a visible `'error'` status on the **CRM Folder** toolbar button instead of silently staying "Connected ✓".

Use **Backups → Restore from CRM Folder** (live single-file) or restore any entry from the **Backups** list (rotating snapshots) to recover.

A floating reminder popup (`main.js:checkBackupReminder()`, `#backupReminderPopup` in `index.html`) nudges the user weekly to copy the CRM folder somewhere safe (OneDrive, USB, etc.) as a manual off-machine backup. Deliberately **not** a modal (`.floating-popup`, not `.modal-backdrop`) - it can't block interaction with the rest of the app even if its dismiss handling ever breaks, unlike the v14.0-14.1 version which could get stuck open.

### Rendering System

The mind map uses a dual-layer rendering approach:
- **SVG layer** (`#linkLayer`) - White Bezier curves connecting parent-child nodes
- **HTML layer** (`#nodeLayer`) - Positioned node cards with absolute positioning

Coordinates are managed through `state.zoom`, `state.tx`, `state.ty` and individual `node.pos` values. The stage transform combines global pan/zoom with per-node positions. On launch, the viewport is centered on the root node (`events.centerOnNode(state.map)`, called from `main.js:init()`).

Node cards have dynamic styling:
- Task nodes turn green (`.task-done`) when done and marked successful, orange (`.node.task-unsuccessful`, v14.2) when done but not marked successful
- **Contact "rotting"** (v14) - a Contact's frame (border) color interpolates from bright green (Last Contact ≤2 weeks ago) to red (≥~4 months ago, or no Last Contact at all) via `nodeOps.getContactRotColor()` / `utils.lerpColor()`. If the user has manually picked a Frame Color for that Contact (`node.colorIsCustom`), rotting doesn't override it - instead a 🚩 flag badge appears once it's been 30+ days since Last Contact. An overdue not-done Task anywhere under the Contact (`nodeOps.getContactNextOpenTask()`) forces full rot regardless of how recent Last Contact is (v14.1.1).
- **"Next" display** (v14.1.1) - the Contact card's "Next: `<date>`" badge no longer reflects the standalone `fields['Next Contact']` field. It only appears when there's an actual outstanding (not-done) Task under the Contact, showing that Task's due date (overdue = red badge, future = plain). No open Task means no "Next" badge at all. The `Next Contact` field/editor input still exists in the data model for manual reference, but no longer drives what's shown on the card.
- **Contact background precedence** (`render.js`, order matters) - (1) "just completed" glow: dark-green gradient for 2 days after a *successful* Task completion (`nodeOps.isRecentlyCompleted()`), overrides everything; a non-successful completion has no effect here (v14.2.1 - a red failure-shade was tried in v14.2 and rolled back); (2) custom card Background Color; (3) default panel color.
- **Selection highlight** (v14.2.1) - `render.js:highlightSelection()` gives selected cards a thick white outline (3px width), doubled reach for multi-selected cards (`state.multiSelectedIds`) vs. a single selection. Since `.node` cards live inside the zoom-scaled `#stage`, the outline width/offset are divided by `state.zoom` so they read as a consistent on-screen size at any zoom level - re-applied after every zoom change (`events.js`: `applyZoom()`, the wheel handler, and `zoomResetBtn`), not just on selection changes.

### Multi-select (v14.2)

Hold **Shift** or **Ctrl** (treated identically - no range-vs-toggle distinction) and drag from empty canvas to draw a marquee-select rectangle (`events.js:initPanning()`, `.marquee-select` in `styles.css` - a screen-space `position:fixed` div, not affected by canvas zoom/pan); every card intersecting it (via `getBoundingClientRect()`) is added to `state.multiSelectedIds`. Shift/ctrl+click a single card toggles it into/out of that set instead of starting a drag. Clicking (and holding) any card that's part of the current multi-selection drags the whole group together via `state.drag.group` (an array of ids) - group drags translate every selected node by the same raw delta and skip the single-drag overlap-avoidance/reparent-on-drop logic entirely, so multiple simultaneously-moving nodes don't fight each other. A plain click on empty canvas (`initStageClick()`) clears `multiSelectedIds` along with resetting `state.selectedId` to root.

### View Modes

Three view modes toggle visibility:
1. **Mind Map** - Visual tree with drag-and-drop positioning
2. **Tasks** - Flat list of all tasks/contacts sorted by due date with status filters
3. **Analytics** - Weekly business development tracking dashboard (2-column grid)

All views operate on the same underlying data structure (`state.map`).

## Development Commands

This is a static HTML/CSS/JS application with no build system.

**To run locally:**
```bash
# Open index.html in a browser
# Or use a simple HTTP server:
python -m http.server 8000
# Then visit http://localhost:8000
```

**No build, lint, or test commands** - this is vanilla JavaScript with no dependencies.

## Key Architectural Patterns

1. **Namespace pattern** - Each module uses an IIFE returning an object assigned to `window.*`
2. **Separation of concerns** - State, rendering, events, and storage are cleanly separated
3. **BFS/DFS traversal** - Tree operations use `nodeOps.bfs()` for efficient tree walking
4. **Dirty tracking** - `state.lastDirty` timestamp enables efficient auto-save
5. **Event delegation** - Node buttons use event delegation via `data-act` attributes
6. **Undo/Redo** - State snapshots managed by `window.UndoManager`

## Keyboard Shortcuts

- **Arrow keys** - Navigate nodes
- **E** - Edit selected node
- **C** - Add child node
- **P** - Create new Contact node
- **T** - Log a completed Task (Contact or Sub-Tree selection only) - due today, status done
- **F** - Fold/unfold node
- **H** - Highlight/flag node
- **D** - Auto-arrange subtree (`nodeOps.tidySubtree()` - grid layout that wraps into additional columns after 8 siblings at the same depth; there is no separate "Meta card" object despite some older docs/dead CSS suggesting otherwise)
- **Delete** - Delete node
- **Shift/Ctrl + drag** (empty canvas) - Marquee-select multiple cards (v14.2)
- **Ctrl+Z** - Undo
- **Ctrl+Shift+Z** - Redo

## Common Tasks

### Adding a new template
1. Add template definition to `config.js:Templates`
2. Add color mappings to `TemplateDefaultsColor` and `TemplateChipColors`
3. Update template select options in `index.html`
4. Add validation rules in `validation.js` if needed

### Modifying node rendering
- Card HTML structure: `render.js:renderMindMap()`
- Node display logic: Template `show()` functions in `config.js`
- Link rendering: `render.js:drawLinks()`
- Status-based styling: `styles.css` (.task-done, .task-unsuccessful, etc.); Contact rotting/fail-shade colors are computed inline in `render.js`, not via CSS classes
- New child placement: `nodeOps.nextChildPos()` - lands directly below the lowest existing sibling, same `gapX`/`gapY` spacing as `tidySubtree()`

### Adding event handlers
- All event binding happens in `events.js`
- Button handlers: `events.js:initButtonHandlers()`
- Keyboard shortcuts: `events.js:initKeyboardShortcuts()`

### Changing persistence format
- Save format: `storage.js:downloadCurrent()`
- Load/migration: `storage.js:applyLoaded()` and `storage.js:migrate()`
- Folder-backed writes: `js/file-persistence.js:scheduleWrite()`/`readSnapshot()`/`snapshotToFolder()`
- Current version: 14.2.1

## Date Formatting

The application uses **DD/MM/YY** display format for Canadian users, but stores dates internally as ISO 8601 (YYYY-MM-DD). Date inputs use native HTML5 `type="date"` which automatically adapts to user locale.

Conversion utilities:
- `utils.formatDateDisplay()` - ISO to DD/MM/YY display
- `utils.parseCanadianDate()` - DD/MM/YY to ISO storage

## RBC Branding

The application uses RBC's official brand colors defined in CSS variables:
- `--rbc-blue: #003168` (primary brand color)
- `--rbc-light-blue: #005daa` (interactive elements)

Template colors follow RBC's brand guidelines with accessible contrast ratios for text legibility.

## Key Node Operations

Helper functions in `node-operations.js`:
- `findParentContact(nodeId)` - Traverses up through Sub-Trees to find parent Contact
- `getContactTasks(contactNode)` - Gets all Tasks under a Contact (including Sub-Trees)
- `getContactRotColor(contact)` - Returns `{color, days}` for the "rotting" frame color based on days since Last Contact (or forced full-rot if there's an overdue open Task)
- `getContactNextOpenTask(contact)` - Returns the soonest-due not-done Task under a Contact (any depth), or `null`
- `isRecentlyCompleted(contact)` - True if `lastTaskCompletedDate` is today or yesterday; drives the temporary green card background
- `applyTaskCompletion(taskNode)` - Stamps parent Contact's Last Contact, stamps `lastTaskCompletedDate` if `taskNode.successful`, and logs Analytics Channel once; idempotent, called on Task creation (T hotkey) and every Task save
- `nextChildPos(parent)` - Deterministic position for a new child, directly below the lowest existing sibling (v14.2)
- `rollUpNote(noteNode)` - Rolls note content to parent Contact
