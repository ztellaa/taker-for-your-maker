// Application State
window.AppState = {
  // Mind map data
  map: null,
  selectedId: null,

  // View state
  zoom: 1,
  tx: 40,
  ty: 45,

  // UI state
  childCycleIndex: new Map(),
  lastDirty: Date.now(),
  listFilter: 'now',

  // Drag state
  drag: null,
  dragStartPos: null,
  isPanning: false,
  panStart: null,

  // Multi-selection state
  multiSelectedIds: new Set(),
  marquee: null,

  // Editor state
  selectedPaletteColor: null,

  // Mindmap background color
  mapBgColor: null
};
