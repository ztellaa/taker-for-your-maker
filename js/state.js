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

  // Editor state
  selectedPaletteColor: null
};
