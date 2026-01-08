// Undo/Redo System
window.UndoManager = (function() {
  var state = window.AppState;
  var storage = window.Storage;
  var render = window.Render;

  var MAX_HISTORY = 50;
  var undoStack = [];
  var redoStack = [];
  var isUndoing = false; // Prevent capturing undo operations themselves

  // Deep clone using structured clone (or JSON fallback)
  function deepClone(obj) {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  }

  // Capture current state before modification
  function capture(operationType, metadata) {
    if (isUndoing) return; // Don't capture during undo/redo

    var snapshot = {
      map: deepClone(state.map),
      selectedId: state.selectedId,
      timestamp: Date.now(),
      operation: operationType, // 'edit', 'add', 'delete', 'move', 'fold', 'highlight'
      metadata: metadata || {} // { nodeId, title, etc. }
    };

    undoStack.push(snapshot);

    // Limit stack size
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    // Clear redo stack on new action
    redoStack = [];

    updateUndoIndicator();
  }

  function undo() {
    if (undoStack.length === 0) return;

    isUndoing = true;

    // Save current state to redo stack
    redoStack.push({
      map: deepClone(state.map),
      selectedId: state.selectedId,
      timestamp: Date.now()
    });

    // Restore previous state
    var snapshot = undoStack.pop();
    state.map = snapshot.map;
    state.selectedId = snapshot.selectedId;

    // Re-render
    storage.markDirty();
    render.renderMindMap();
    render.buildList();

    updateUndoIndicator();

    isUndoing = false;
  }

  function redo() {
    if (redoStack.length === 0) return;

    isUndoing = true;

    // Save current state to undo stack
    undoStack.push({
      map: deepClone(state.map),
      selectedId: state.selectedId,
      timestamp: Date.now()
    });

    // Restore next state
    var snapshot = redoStack.pop();
    state.map = snapshot.map;
    state.selectedId = snapshot.selectedId;

    // Re-render
    storage.markDirty();
    render.renderMindMap();
    render.buildList();

    updateUndoIndicator();

    isUndoing = false;
  }

  function updateUndoIndicator() {
    var indicator = document.getElementById('undoIndicator');
    if (indicator) {
      var undoCount = undoStack.length;
      var redoCount = redoStack.length;
      indicator.textContent = undoCount + ' undo' + (redoCount > 0 ? ' | ' + redoCount + ' redo' : '');
      indicator.title = 'Undo: Ctrl+Z, Redo: Ctrl+Shift+Z';
    }
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  // Public API
  return {
    capture: capture,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo
  };
})();
