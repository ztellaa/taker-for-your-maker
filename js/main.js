// Main Initialization
window.Main = (function() {
  var utils = window.Utils;
  var state = window.AppState;
  var nodeOps = window.NodeOps;
  var storage = window.Storage;
  var render = window.Render;
  var editor = window.Editor;
  var modals = window.Modals;
  var events = window.Events;

  function createDemoData() {
    state.map = nodeOps.newNode('RBC Wealth Portfolio','Client',null);
    state.map.pos = {x:0,y:0};
    state.selectedId = state.map.id;

    var c1 = nodeOps.newNode('Jane Smith','Client',state.map);
    c1.fields['Email'] = 'jane.smith@email.com';
    c1.fields['First Name'] = 'Jane';
    c1.fields['Last Name'] = 'Smith';
    c1.fields['AUM'] = '2500000';
    c1.fields['Last Contact'] = '2025-01-10';
    c1.fields['Next Contact'] = '2025-02-15';
    c1.freq = 'quarterly';

    var coi = nodeOps.newNode('Michael Chen','COI',state.map);
    coi.fields['Email'] = 'michael.chen@accounting.ca';
    coi.fields['First Name'] = 'Michael';
    coi.fields['Last Name'] = 'Chen';
    coi.fields['Business Type'] = 'CPA';
    coi.fields['Last Contact'] = '2024-12-20';
    coi.fields['Next Contact'] = '2025-03-20';
    coi.freq = 'biannually';

    var a1 = nodeOps.newNode('RRSP #8821','Account',c1);
    a1.fields['Holdings'] = '850000';

    var o1 = nodeOps.newNode('Estate Planning Review','Opportunity',c1);
    o1.fields['Email'] = 'jane.smith@email.com';
    o1.fields['First Name'] = 'Jane';
    o1.fields['Last Name'] = 'Smith';
    o1.fields['Last Contact'] = '2025-01-05';
    o1.fields['Next Contact'] = '2025-01-25';

    nodeOps.ensureScaffolding();
    state.map.children.push(c1, coi);
    c1.children.push(a1, o1);
  }

  function restore() {
    var restored = storage.restore();
    if(!restored) {
      createDemoData();
      render.renderMindMap();
      render.buildList();
    }
  }

  function initAutosave() {
    // Timer-based autosave
    setInterval(function() {
      if(Date.now() - state.lastDirty < 60000) {
        storage.snapshotBackup('timer');
      }
    }, 30000);

    // Backup on visibility change
    document.addEventListener('visibilitychange', function() {
      if(document.hidden) {
        storage.snapshotBackup('hide');
      }
    });

    // Backup before unload
    window.addEventListener('beforeunload', function() {
      storage.snapshotBackup('beforeunload');
    });
  }

  function initResize() {
    window.addEventListener('resize', function() {
      render.renderMindMap();
    });
  }

  function init() {
    // Restore saved data or create demo data
    restore();

    // Initialize all subsystems
    events.initStageClick();
    events.initWheelZoom();
    events.initPanning();
    events.initDragAndDrop();
    events.initButtonHandlers();
    events.initNodeClickHandlers();
    events.initKeyboardShortcuts();
    events.initSearch();
    events.initViewToggles();
    editor.init();
    modals.init();
    initAutosave();
    initResize();

    // Apply initial transform
    events.stageTransform();
  }

  // Public API
  return {
    init: init,
    restore: restore,
    createDemoData: createDemoData
  };
})();

// Auto-initialize when DOM is ready
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.Main.init);
} else {
  window.Main.init();
}
