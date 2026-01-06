# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Seetal Cornish CRM** is a wealth management CRM system designed for RBC advisors. It provides a visual mind map interface for managing clients, contacts of influence (COIs), accounts, tasks, and opportunities. The application runs entirely in the browser with localStorage persistence.

## Architecture

### Module Loading Order

The application uses vanilla JavaScript with modules loaded via script tags in a specific dependency order (see index.html:187-198):

1. **config.js** - Configuration, templates, and color schemes
2. **utils.js** - Utility functions (date formatting, escaping, UUIDs, etc.)
3. **dom-refs.js** - Centralized DOM element references
4. **state.js** - Global application state (AppState namespace)
5. **node-operations.js** - Node CRUD, tree traversal (BFS/DFS), and node scaffolding
6. **render.js** - Rendering logic for mind map, links, task list, and stats
7. **storage.js** - LocalStorage persistence and automatic backup system
8. **editor.js** - Node editing modal and field management
9. **modals.js** - Backup and mailing list modals
10. **events.js** - All event handlers (drag-and-drop, zoom, keyboard shortcuts, etc.)
11. **main.js** - Initialization and orchestration

All modules expose their functionality through `window.*` namespaces (e.g., `window.Utils`, `window.AppState`, `window.NodeOps`).

### Core Data Structure

Nodes are tree-structured objects with this shape:
```javascript
{
  id: string,           // UUID
  title: string,
  template: string,     // 'Client', 'COI', 'Account', 'Task', 'Opportunity', 'Recurring Contact', 'Note', 'Sub-Tree'
  status: string,       // 'todo', 'inprogress', 'blocked', 'done', 'A-tier', 'B-tier', 'C-tier', 'Dormant'
  due: string,          // ISO date (YYYY-MM-DD)
  notes: string,
  fields: object,       // Template-specific fields
  freq: string,         // 'monthly', 'quarterly', 'biannually', 'annually'
  highlight: boolean,   // User flag for important nodes
  proxyHighlight: boolean, // Computed: collapsed node with highlighted descendants
  collapsed: boolean,
  color: string,        // Hex color
  anchored: boolean,    // Reserved for future use
  children: array,
  pos: {x, y}          // Absolute coordinates in mind map
}
```

### Auto-scaffolding

When creating Client or COI nodes, the system automatically creates two child Sub-Trees:
- **Recurring Contacts** - contains a pre-configured recurring contact task
- **Tasks** - empty container for client-specific tasks

This scaffolding logic lives in `node-operations.js:newNode()`.

### Template System

Templates define the data fields for each node type and optional custom display functions. See `config.js:Templates` for the full configuration.

Key templates:
- **Client/COI** - Core relationship records with AUM tracking, contact schedules
- **Account** - Financial accounts (RRSP, TFSA, etc.)
- **Task** - Time-bound action items
- **Opportunity** - Sales pipeline tracking
- **Recurring Contact** - Scheduled touchpoints with frequency-based due dates
- **Sub-Tree** - Organizational containers with hierarchical font sizing

### Persistence

The application uses two localStorage keys:
- `wm.mindmap` - Current state, updated on every modification (markDirty)
- `wm.backups` - Rolling array of last 10 automatic snapshots

Backups are triggered:
- Every 30 seconds (if dirty)
- On visibility change (tab switch/minimize)
- Before page unload
- Manual save button

### Rendering System

The mind map uses a dual-layer rendering approach:
- **SVG layer** (`#linkLayer`) - Bezier curves connecting parent-child nodes
- **HTML layer** (`#nodeLayer`) - Positioned node cards with absolute positioning

Coordinates are managed through `state.zoom`, `state.tx`, `state.ty` and individual `node.pos` values. The stage transform combines global pan/zoom with per-node positions.

### View Modes

Two view modes toggle visibility:
1. **Mind Map** - Visual tree with drag-and-drop positioning
2. **Tasks** - Flat list of all tasks/contacts sorted by due date with status filters

Both views operate on the same underlying data structure (`state.map`).

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

## Common Tasks

### Adding a new template
1. Add template definition to `config.js:Templates`
2. Add color mappings to `TemplateDefaultsColor` and `TemplateChipColors`
3. Update template select options in `index.html:22`

### Modifying node rendering
- Card HTML structure: `render.js:renderMindMap()`
- Node display logic: Template `show()` functions in `config.js`
- Link rendering: `render.js:drawLinks()`

### Adding event handlers
- All event binding happens in `events.js`
- Button handlers: `events.js:initButtonHandlers()`
- Keyboard shortcuts: `events.js:initKeyboardShortcuts()`

### Changing persistence format
- Save format: `storage.js:downloadCurrent()`
- Load/migration: `storage.js:applyLoaded()` and `storage.js:migrate()`
- Current version: 12.1

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
