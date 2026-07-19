// Storage and Persistence
window.Storage = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var nodeOps = window.NodeOps;

  var BACKUP_KEY = 'wm.backups';
  var CURRENT_VERSION = '14.1.0';

  function markDirty() {
    state.lastDirty = Date.now();
    var payload = {
      version: CURRENT_VERSION,
      createdAt: Date.now(),
      map: state.map,
      mapBgColor: state.mapBgColor
    };
    try {
      localStorage.setItem('wm.mindmap', JSON.stringify(payload));
    } catch(e) {}
    if(window.FilePersistence) {
      window.FilePersistence.scheduleWrite(payload);
    }
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
      map: state.map,
      mapBgColor: state.mapBgColor
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
    state.mapBgColor = data.mapBgColor || null;
    nodeOps.ensurePositions();
    // Apply saved map background color
    if(window.Events && window.Events.applyMapBackground) {
      window.Events.applyMapBackground(state.mapBgColor);
    }
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

    // Version 14.0.0 migration: Touch template removed - convert to completed/todo Task
    if (versionNum < 14) {
      var channelByTouchType = {Call: 'calls', LinkedIn: 'linkedin', Email: 'emails'};
      nodeOps.bfs(m, function(n) {
        if (n.template === 'Touch') {
          var touchType = (n.fields && n.fields['Touch Type']) || '';
          var wasCompleted = n.fields && n.fields['Status'] === 'Completed';
          n.template = 'Task';
          n.status = wasCompleted ? 'done' : 'todo';
          n.fields = n.fields || {};
          n.fields['Channel'] = channelByTouchType[touchType] || '';
          delete n.fields['Touch Type'];
          delete n.fields['Status'];
          n.color = config.TemplateDefaultsColor['Task'];
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

      // Backfill v14 node flags
      if (n.colorIsCustom == null) n.colorIsCustom = false;
      if (n.analyticsLogged == null) n.analyticsLogged = false;

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

        // Migrate Activity Offset to freq (v13.0.7)
        if (n.fields['Activity Offset'] && !n.freq) {
          var offset = parseInt(n.fields['Activity Offset']);
          if (offset <= 30) n.freq = 'monthly';
          else if (offset <= 90) n.freq = 'quarterly';
          else if (offset <= 182) n.freq = 'biannually';
          else n.freq = 'annually';
        }
        delete n.fields['Activity Offset'];
      }

      // Task-specific field initialization
      if (n.template === 'Task') {
        n.fields['Channel'] = n.fields['Channel'] || '';
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
          state.mapBgColor = data.mapBgColor || null;
          if(window.Events && window.Events.applyMapBackground) {
            window.Events.applyMapBackground(state.mapBgColor);
          }
          nodeOps.ensurePositions();
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
