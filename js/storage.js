// Storage and Persistence
window.Storage = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var nodeOps = window.NodeOps;

  var BACKUP_KEY = 'wm.backups';

  function markDirty() {
    state.lastDirty = Date.now();
    try {
      localStorage.setItem('wm.mindmap', JSON.stringify({
        version: '13.0.3',
        createdAt: Date.now(),
        map: state.map
      }));
    } catch(e) {}
  }

  function sanitize(s) {
    return String(s).replace(/[^a-z0-9\- _]/gi,'_');
  }

  function rootTitle() {
    return (state.map && state.map.title) ? state.map.title : 'Map';
  }

  function downloadCurrent() {
    var payload = {
      version: '13.0.3',
      createdAt: Date.now(),
      map: state.map
    };

    try {
      localStorage.setItem('wm.mindmap', JSON.stringify(payload));
    } catch(e) {}

    var name = sanitize(rootTitle()) + '-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    var blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function applyLoaded(data) {
    var m = (data && data.map) ? migrate(data) : migrate({version:0, map:data});
    state.map = m.map;
    state.selectedId = state.map.id;
    nodeOps.ensurePositions();
    nodeOps.ensureScaffolding();
    markDirty();
    window.Render.renderMindMap();
    window.Render.buildList();
  }

  // Backup management
  function readBackups() {
    try {
      return JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]');
    } catch(e) {
      return [];
    }
  }

  function writeBackups(list) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function snapshotBackup(reason) {
    if(reason===undefined) reason = 'autosave';
    var payload = {
      version: '13.0.3',
      createdAt: Date.now(),
      reason: reason,
      map: state.map
    };
    var name = sanitize(rootTitle()) + '-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    var entry = {
      name: name,
      ts: Date.now(),
      payload: payload
    };

    var list = readBackups();
    list.unshift(entry);
    while(list.length > 10) list.pop();
    writeBackups(list);
  }

  // Migration
  function migrate(input) {
    var version = input.version, m = input.map;
    if(!version) version = 0;

    nodeOps.bfs(m, function(n,p) {
      n.fields = n.fields || {};
      if(n.fields['Web']===undefined) n.fields['Web'] = '';
      if(n.fields['LinkedIn']===undefined) n.fields['LinkedIn'] = '';
      n.notes = n.notes || '';
      n.status = n.status || ((n.template==='Task'||n.template==='Recurring Contact') ? 'todo' : (['Client','COI','Opportunity'].indexOf(n.template)!==-1 ? 'A-tier' : ''));
      n.due = n.due || '';
      n.template = n.template || ((p && p.template) || 'Client');
      n.color = n.color || nodeOps.defaultColorForTemplate(n.template);
      n.collapsed = !!n.collapsed;
      n.highlight = !!n.highlight;
      n.proxyHighlight = !!n.proxyHighlight;
      n.anchored = !!n.anchored;
      n.pos = n.pos || {x:0,y:0};
      if(!n.fields['Tags']) n.fields['Tags'] = '';
      if(n.freq==null) n.freq = '';

      if(n.template==='Client'||n.template==='COI'||n.template==='Opportunity') {
        n.fields['Email'] = n.fields['Email']||'';
        n.fields['Cell Number'] = n.fields['Cell Number']||'';
        n.fields['Lead Source'] = n.fields['Lead Source']||'';
        n.fields['Birthday'] = n.fields['Birthday']||'';
        n.fields['Employer'] = n.fields['Employer']||'';
        n.fields['Salesforce'] = n.fields['Salesforce']||'';
        n.fields['Last Contact'] = n.fields['Last Contact']||'';
        n.fields['Next Contact'] = n.fields['Next Contact']||'';
      }
      nodeOps.ensureTags(n);
    });

    // Version 13 migration: normalize phone numbers
    if (version < 13) {
      nodeOps.bfs(m, function(n) {
        if (n.fields && n.fields['Cell Number']) {
          var phone = n.fields['Cell Number'].replace(/\D/g, '');
          if (phone.length === 10) {
            n.fields['Cell Number'] = phone.substring(0, 3) + ' ' +
                                       phone.substring(3, 6) + ' ' +
                                       phone.substring(6);
          }
        }
      });
    }

    return {version:13.0, map:m};
  }

  function restore() {
    var raw = localStorage.getItem('wm.mindmap');
    if(raw) {
      try {
        var data = JSON.parse(raw);
        if(data && data.map) {
          var m = migrate(data);
          state.map = m.map;
          state.selectedId = state.map.id;
          nodeOps.ensurePositions();
          nodeOps.ensureScaffolding();
          window.Render.renderMindMap();
          window.Render.buildList();
          return true;
        }
      } catch(e) {}
    }
    return false;
  }

  // Public API
  return {
    markDirty: markDirty,
    downloadCurrent: downloadCurrent,
    applyLoaded: applyLoaded,
    readBackups: readBackups,
    writeBackups: writeBackups,
    snapshotBackup: snapshotBackup,
    migrate: migrate,
    restore: restore
  };
})();
