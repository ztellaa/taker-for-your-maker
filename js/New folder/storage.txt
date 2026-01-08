// Storage and Persistence
window.Storage = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var nodeOps = window.NodeOps;

  var BACKUP_KEY = 'wm.backups';
  var CURRENT_VERSION = '13.0.4';

  function markDirty() {
    state.lastDirty = Date.now();
    try {
      localStorage.setItem('wm.mindmap', JSON.stringify({
        version: CURRENT_VERSION,
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
      version: CURRENT_VERSION,
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
      version: CURRENT_VERSION,
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

    // Parse version string to number for comparison
    var versionNum = parseFloat(version);

    // First pass: basic field initialization
    nodeOps.bfs(m, function(n,p) {
      n.fields = n.fields || {};
      if(n.fields['Web']===undefined) n.fields['Web'] = '';
      if(n.fields['LinkedIn']===undefined) n.fields['LinkedIn'] = '';
      n.notes = n.notes || '';
      n.due = n.due || '';
      n.collapsed = !!n.collapsed;
      n.highlight = !!n.highlight;
      n.proxyHighlight = !!n.proxyHighlight;
      n.anchored = !!n.anchored;
      n.pos = n.pos || {x:0,y:0};
      if(!n.fields['Tags']) n.fields['Tags'] = '';
      if(n.freq==null) n.freq = '';
      nodeOps.ensureTags(n);
    });

    // Version 13 migration: normalize phone numbers
    if (versionNum < 13) {
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

    // Version 13.0.4 migration: Template consolidation
    if (versionNum < 13.04) {
      // Convert Client, COI, Opportunity to Contact template
      nodeOps.bfs(m, function(n) {
        if (['Client', 'COI', 'Opportunity'].indexOf(n.template) !== -1) {
          n.template = 'Contact';
          // Ensure Activity Offset field exists
          if (!n.fields['Activity Offset']) {
            n.fields['Activity Offset'] = '';
          }
          // Ensure LinkedIn field exists (may have been missing on some old nodes)
          if (!n.fields['LinkedIn']) {
            n.fields['LinkedIn'] = '';
          }
          // Update color to Contact color if it was using old template color
          var oldColors = ['#003168', '#005daa', '#8b5cf6'];
          if (oldColors.indexOf(n.color) !== -1) {
            n.color = config.TemplateDefaultsColor['Contact'] || '#003168';
          }
        }

        // Convert Recurring Contact to Task
        if (n.template === 'Recurring Contact') {
          var freq = n.fields['Frequency'] || n.freq || '';
          n.template = 'Task';
          // Preserve frequency info in notes
          if (freq) {
            n.notes = (n.notes || '') + (n.notes ? '\n' : '') + '[Migrated from Recurring Contact: ' + freq + ']';
          }
          // Keep the due date as-is
          n.status = n.status || 'todo';
          // Update color to Task color
          n.color = config.TemplateDefaultsColor['Task'] || '#f59e0b';
        }
      });

      // Remove empty "Recurring Contacts" Sub-Trees and move any remaining children up
      nodeOps.bfs(m, function(n) {
        if (n.children && n.children.length) {
          var newChildren = [];
          for (var i = 0; i < n.children.length; i++) {
            var child = n.children[i];
            if (child.template === 'Sub-Tree' && /^Recurring Contacts$/i.test(child.title)) {
              // Move any grandchildren up to this level
              if (child.children && child.children.length) {
                for (var j = 0; j < child.children.length; j++) {
                  newChildren.push(child.children[j]);
                }
              }
              // Skip adding the Recurring Contacts Sub-Tree itself
            } else {
              newChildren.push(child);
            }
          }
          n.children = newChildren;
        }
      });
    }

    // Update status and template defaults for all nodes
    nodeOps.bfs(m, function(n,p) {
      // Set default status based on template
      if (!n.status) {
        if (n.template === 'Task') {
          n.status = 'todo';
        } else if (n.template === 'Contact') {
          n.status = 'A-tier';
        } else if (n.template === 'Touch') {
          n.status = '';
          if (!n.fields['Status']) {
            n.fields['Status'] = 'Not Completed';
          }
        } else {
          n.status = '';
        }
      }

      // Set default template if missing
      if (!n.template) {
        n.template = (p && p.template) || 'Contact';
      }

      // Ensure color is set
      if (!n.color) {
        n.color = nodeOps.defaultColorForTemplate(n.template);
      }

      // Contact-specific field initialization
      if (n.template === 'Contact') {
        n.fields['Email'] = n.fields['Email'] || '';
        n.fields['Cell Number'] = n.fields['Cell Number'] || '';
        n.fields['Lead Source'] = n.fields['Lead Source'] || '';
        n.fields['Birthday'] = n.fields['Birthday'] || '';
        n.fields['Employer'] = n.fields['Employer'] || '';
        n.fields['Salesforce'] = n.fields['Salesforce'] || '';
        n.fields['Last Contact'] = n.fields['Last Contact'] || '';
        n.fields['Next Contact'] = n.fields['Next Contact'] || '';
        n.fields['LinkedIn'] = n.fields['LinkedIn'] || '';
        n.fields['Activity Offset'] = n.fields['Activity Offset'] || '';
      }

      // Touch-specific field initialization
      if (n.template === 'Touch') {
        n.fields['Touch Type'] = n.fields['Touch Type'] || '';
        n.fields['Status'] = n.fields['Status'] || 'Not Completed';
      }
    });

    return {version: CURRENT_VERSION, map: m};
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
