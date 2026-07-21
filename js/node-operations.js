// Node Operations and Manipulation
window.NodeOps = (function() {
  var config = window.AppConfig;
  var utils = window.Utils;
  var state = window.AppState;

  function defaultColorForTemplate(t) {
    return config.TemplateDefaultsColor[t] || '#003168';
  }

  function ensureTags(n) {
    var t = (n.fields['Tags']||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    var wanted = ['template','node',(n.template||'').toLowerCase()];
    wanted.forEach(function(tag){
      if(t.indexOf(tag)===-1) t.push(tag);
    });
    n.fields['Tags'] = t.join(', ');
  }

  // Where a new child of `parent` should land - directly below the lowest
  // existing sibling, one gapY further down, at a fixed gapX from the
  // parent. No randomness, and it looks at actual sibling positions rather
  // than a naive child-count multiplier, so cards don't clump/scatter after
  // siblings have been dragged around or auto-arranged. Same spacing
  // convention as tidySubtree() (the "Arrange" function) for visual
  // consistency between manual and auto-arranged layouts.
  function nextChildPos(parent) {
    if(!parent || !parent.pos) return {x:0, y:0};
    var gapX = 300, gapY = 100;
    var siblingYs = (parent.children||[]).filter(function(c){ return c.pos; }).map(function(c){ return c.pos.y; });
    var y = siblingYs.length ? Math.max.apply(null, siblingYs) + gapY : parent.pos.y;
    return {x: parent.pos.x + gapX, y: y};
  }

  function newNode(title, tmpl, parent) {
    if(title===undefined) title="Untitled";
    if(tmpl===undefined) tmpl="";
    if(parent===undefined) parent=null;

    var effective = tmpl || (parent && parent.template) || 'Contact';
    var tFields = (config.Templates[effective] && config.Templates[effective].fields) ?
      (function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(config.Templates[effective].fields) : {};
    if(!tFields['Tags']) tFields['Tags']='';
    if(effective === 'Contact') {
      tFields['Last Contact'] = utils.today();
    }

    var color = (parent && parent.template==='Sub-Tree') ? (parent.color||defaultColorForTemplate(effective)) : defaultColorForTemplate(effective);

    // Set default status based on template
    var defaultStatus = '';
    if (effective === 'Task') {
      defaultStatus = 'todo';
    } else if (effective === 'Contact') {
      defaultStatus = 'A-tier';
    }

    var node = {
      id: utils.uuid(),
      title: title,
      template: effective,
      status: defaultStatus,
      due: '',
      notes: '',
      fields: tFields,
      freq: (effective === 'Contact') ? 'daily' : '',
      highlight: false,
      proxyHighlight: false,
      collapsed: false,
      color: color,
      colorIsCustom: false,
      analyticsLogged: false,
      lastTaskCompletedDate: '',
      successful: false,
      failedTaskStreak: 0,
      completionCounted: false,
      anchored: false,
      children: [],
      pos: parent ? nextChildPos(parent) : {x:0,y:0}
    };

    ensureTags(node);

    return node;
  }

  // Traversal helpers
  function bfs(root, fn) {
    var q = [{node:root, parent:null, depth:0}];
    while(q.length) {
      var cur = q.shift();
      fn(cur.node, cur.parent, cur.depth);
      cur.node.children.forEach(function(c){
        q.push({node:c, parent:cur.node, depth:cur.depth+1});
      });
    }
  }

  function findNode(id) {
    var out = null, parent = null;
    bfs(state.map, function(n,p){
      if(n.id===id) { out=n; parent=p; }
    });
    return {node:out, parent:parent};
  }

  // Set of ids currently visible in the rendered tree (excludes descendants
  // of a collapsed node). Shared by render.js and the drag-overlap logic in
  // events.js so dragging can't collide with cards the user can't see.
  function getVisibleIds() {
    var visible = new Set();
    (function walk(n) {
      visible.add(n.id);
      if(n.collapsed) return;
      n.children.forEach(walk);
    })(state.map);
    return visible;
  }

  function isDescendant(ancestorId, id) {
    var res = false;
    var a = findNode(ancestorId).node;
    if(!a) return false;
    bfs(a, function(n){ if(n.id===id) res=true; });
    return res;
  }

  function depthOf(id) {
    var d = 0;
    (function dfs(n,dd){
      if(n.id===id) { d=dd; return true; }
      for(var i=0; i<n.children.length; i++) {
        if(dfs(n.children[i], dd+1)) return true;
      }
      return false;
    })(state.map, 0);
    return d;
  }

  function ensurePositions() {
    if(!state.map.pos) state.map.pos = {x:0,y:0};
    bfs(state.map, function(n,p){
      if(!n.pos) {
        var base = (p && p.pos) || {x:0,y:0};
        n.pos = {x:base.x+280, y:base.y+(p?p.children.indexOf(n)*100:0)};
      }
      if(!n.color) n.color = defaultColorForTemplate(n.template||'Contact');
      if(typeof n.collapsed!=='boolean') n.collapsed = false;
      if(typeof n.anchored!=='boolean') n.anchored = false;
      if(typeof n.proxyHighlight!=='boolean') n.proxyHighlight = false;
      if(n.freq==null) n.freq = '';

      // Contact-specific field initialization
      if(n.template==='Contact') {
        n.fields['Email'] = n.fields['Email']||'';
        n.fields['Cell Number'] = n.fields['Cell Number']||'';
        n.fields['Lead Source'] = n.fields['Lead Source']||'';
        n.fields['Birthday'] = n.fields['Birthday']||'';
        n.fields['Employer'] = n.fields['Employer']||'';
        n.fields['Salesforce'] = n.fields['Salesforce']||'';
        n.fields['Last Contact'] = n.fields['Last Contact']||'';
        n.fields['Next Contact'] = n.fields['Next Contact']||'';
        n.fields['LinkedIn'] = n.fields['LinkedIn']||'';
      }

      ensureTags(n);
    });
  }

  function tidySubtree(rootId) {
    var root = findNode(rootId).node;
    if(!root) return;

    // First, fold all grandchildren (children of root's children)
    if(root.children) {
      root.children.forEach(function(child) {
        if(child.children && child.children.length > 0) {
          child.collapsed = true;
        }
      });
    }

    var gapX = 300, gapY = 100;
    var maxPerColumn = 8;
    var start = depthOf(rootId);
    var origin = {x:root.pos.x, y:root.pos.y};
    var columnCounts = {};
    var columnOffsets = {};

    function getColumnOffset(depth) {
      if(columnOffsets[depth] === undefined) {
        columnOffsets[depth] = 0;
      }
      return columnOffsets[depth];
    }

    function incrementColumn(depth) {
      if(columnCounts[depth] === undefined) {
        columnCounts[depth] = 0;
      }
      columnCounts[depth]++;
      if(columnCounts[depth] >= maxPerColumn) {
        columnCounts[depth] = 0;
        columnOffsets[depth] = (columnOffsets[depth] || 0) + 1;
      }
    }

    function setPos(n, depth, y) {
      var colOffset = getColumnOffset(depth);
      // Columns on same row (horizontal arrangement)
      n.pos.x = origin.x + (depth - start) * gapX + colOffset * (gapX + 20);
      n.pos.y = y;
      if(n !== root) n.anchored = true;
    }

    function place(n, depth) {
      if(n.collapsed) {
        var baseY = origin.y + (columnCounts[depth] || 0) * gapY;
        setPos(n, depth, baseY);
        incrementColumn(depth);
        return {top:n.pos.y, bottom:n.pos.y};
      }

      if(n.children.length===0) {
        var y = origin.y + (columnCounts[depth] || 0) * gapY;
        setPos(n, depth, y);
        incrementColumn(depth);
        return {top:y, bottom:y};
      }

      var top = Infinity, bottom = -Infinity;
      for(var i=0; i<n.children.length; i++) {
        var span = place(n.children[i], depth+1);
        top = Math.min(top, span.top);
        bottom = Math.max(bottom, span.bottom);
      }

      var mid = (top+bottom)/2;
      var y2 = Math.max(mid, origin.y + (columnCounts[depth] || 0) * gapY);
      setPos(n, depth, y2);
      incrementColumn(depth);
      return {top:Math.min(top,y2), bottom:Math.max(bottom,y2)};
    }

    place(root, start);
  }

  function propagateProxyHighlights() {
    function hasHighlightedDesc(n) {
      var found = false;
      (function walk(x){
        if(x.highlight) { found=true; return; }
        x.children.forEach(walk);
      })(n);
      return found;
    }

    bfs(state.map, function(n){ n.proxyHighlight=false; });
    bfs(state.map, function(n){
      if(n.collapsed) {
        for(var i=0; i<n.children.length; i++) {
          var c = n.children[i];
          if(hasHighlightedDesc(c)) {
            n.proxyHighlight = true;
            break;
          }
        }
      }
    });
  }

  function nextDueForCard(n) {
    var direct = (n.children||[]).filter(function(c){ return c.template==='Task'; });
    var fromSubtrees = (n.children||[]).filter(function(c){ return c.template==='Sub-Tree'; }).flatMap(function(st){
      return (st.children||[]).filter(function(x){ return x.template==='Task'; });
    });
    var dues = direct.concat(fromSubtrees).map(function(t){ return t.due; }).filter(Boolean).sort();
    return dues[0]||'';
  }

  function cumulativeAUM(n) {
    var total = 0;

    function collectAUM(node) {
      if(node.fields && node.fields.AUM) {
        var aumVal = parseFloat(String(node.fields.AUM).replace(/[,$]/g, ''));
        if(!isNaN(aumVal)) {
          total += aumVal;
        }
      }

      if(node.children) {
        node.children.forEach(function(child) {
          collectAUM(child);
        });
      }
    }

    if(n.children) {
      n.children.forEach(function(child) {
        collectAUM(child);
      });
    }

    return total;
  }

  function crumbsOf(id) {
    var out = [];
    (function dfs(n,path){
      if(n.id===id) {
        Array.prototype.push.apply(out, path);
        return true;
      }
      for(var i=0; i<n.children.length; i++) {
        if(dfs(n.children[i], path.concat([n.title]))) return true;
      }
      return false;
    })(state.map, []);
    return out;
  }

  // Node operations
  function addChildOf(parentId) {
    var parent = findNode(parentId).node;
    if(!parent) return;

    var tmpl = window.DOM.templateSelect.value || parent.template || 'Contact';

    // Default to Task for Contact, Account nodes when no template explicitly selected
    if(!window.DOM.templateSelect.value && (parent.template==='Account'||parent.template==='Contact')) {
      tmpl = 'Task';
    }

    var child = newNode(tmpl?tmpl:'New node', tmpl, parent);

    // Set due date for Task nodes
    if(tmpl==='Task' && !child.due) {
      var days = Math.max(0, parseInt(window.DOM.defaultOffsetInput.value||'7',10));
      var dt = new Date(Date.now()+days*86400000);
      child.due = dt.toISOString().slice(0,10);
    }

    parent.children.push(child);
    state.selectedId = child.id;
    return child.id;
  }

  function toggleHighlightCascade(id) {
    var node = findNode(id).node;
    if(!node) return;
    var target = !node.highlight;
    (function apply(n){
      n.highlight = target;
      n.children.forEach(apply);
    })(node);
  }

  function toggleFold(id) {
    var node = findNode(id).node;
    if(!node) return;
    node.collapsed = !node.collapsed;
  }

  function deleteNodeCascade(id) {
    var found = findNode(id), node = found.node, parent = found.parent;
    if(!node) return;

    var ok = window.confirm('Delete "'+node.title+'" and all of its children? This cannot be undone.');
    if(!ok) return;

    state.multiSelectedIds.clear();

    if(state.map.id===id) {
      state.map = newNode('Root','Contact',null);
      state.map.pos = {x:0,y:0};
      state.selectedId = state.map.id;
    } else {
      parent.children = parent.children.filter(function(c){ return c.id!==id; });
      state.selectedId = parent.id;
    }
  }

  // Get available contact channels from parent Contact
  function getAvailableChannels(taskNode) {
    if(!taskNode || taskNode.template !== 'Task') {
      return { call: true, email: true, linkedin: true }; // Default all enabled if not a task
    }

    // Find parent Contact (may be through Sub-Tree)
    var taskInfo = findNode(taskNode.id);
    var parent = taskInfo.parent;
    var contact = null;

    if(parent && parent.template === 'Contact') {
      contact = parent;
    } else if(parent && parent.template === 'Sub-Tree') {
      var grandparent = findNode(parent.id).parent;
      if(grandparent && grandparent.template === 'Contact') {
        contact = grandparent;
      }
    }

    if(!contact) {
      return { call: true, email: true, linkedin: true }; // Default all enabled if no contact found
    }

    return {
      call: !!(contact.fields['Cell Number'] || contact.fields['Phone'] || '').trim(),
      email: !!(contact.fields['Email'] || '').trim(),
      linkedin: !!(contact.fields['LinkedIn'] || contact.fields['Salesforce'] || '').trim()
    };
  }

  // Find parent Contact for a node (traverses through Sub-Trees)
  function findParentContact(nodeId) {
    var current = findNode(nodeId);
    while(current.parent) {
      if(current.parent.template === 'Contact') {
        return current.parent;
      }
      current = findNode(current.parent.id);
    }
    return null;
  }

  // Get all descendant nodes of a specific template type for a Contact (including Sub-Trees)
  function getContactDescendants(contactNode, templateType) {
    if(!contactNode || contactNode.template !== 'Contact') return [];
    var results = [];
    bfs(contactNode, function(n) {
      if(n.template === templateType) {
        results.push(n);
      }
    });
    return results;
  }

  // Get all Tasks for a Contact (including those in Sub-Trees)
  function getContactTasks(contactNode) {
    return getContactDescendants(contactNode, 'Task');
  }

  // The soonest-due not-done Task under a Contact (any depth), or null if
  // there isn't one. Since it's the soonest, if it's overdue then every
  // open Task is overdue too - "is anything overdue" and "what's next" are
  // both answered by this same lookup.
  function getContactNextOpenTask(contactNode) {
    var openTasks = getContactTasks(contactNode).filter(function(t) {
      return t.status !== 'done' && t.due;
    });
    if(!openTasks.length) return null;
    openTasks.sort(function(a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return openTasks[0];
  }

  // "Rotting" - Contact frame color interpolates green (<=2wk since Last
  // Contact) to red (>=~4mo). No Last Contact at all is treated as most-rotten.
  // An overdue open Task forces full rot regardless of Last Contact recency.
  function getContactRotColor(contact) {
    var last = contact && contact.fields && contact.fields['Last Contact'];
    var days = last ? utils.daysBetween(last, utils.today()) : Infinity;

    var openTask = getContactNextOpenTask(contact);
    if(openTask && openTask.due < utils.today()) {
      days = Infinity;
    }

    var t = utils.clamp((days - 14) / (120 - 14), 0, 1);
    return {color: utils.lerpColor('#10b981', '#ef4444', t), days: days};
  }

  // Apply the side effects of a Task being completed: stamp the parent
  // Contact's Last Contact (drives "rotting"), and either reset or extend
  // its failure streak depending on whether the Task was marked successful
  // (see the "Success!" editor button) - a success also stamps
  // lastTaskCompletedDate (drives the temporary green card background), a
  // non-success does not. Also logs to Analytics once if a Channel is set.
  // The completionCounted/analyticsLogged guards make this idempotent - safe
  // to call on every Task save, not just the first time it's marked done.
  function applyTaskCompletion(taskNode) {
    if(!taskNode || taskNode.template !== 'Task' || taskNode.status !== 'done') return;

    var contact = findParentContact(taskNode.id);
    if(contact) {
      contact.fields['Last Contact'] = utils.today();

      if(!taskNode.completionCounted) {
        if(taskNode.successful) {
          contact.failedTaskStreak = 0;
          contact.lastTaskCompletedDate = utils.today();
        } else {
          contact.failedTaskStreak = (contact.failedTaskStreak || 0) + 1;
        }
        taskNode.completionCounted = true;
      }
    }

    if(taskNode.fields && taskNode.fields['Channel'] && !taskNode.analyticsLogged) {
      if(window.Analytics && window.Analytics.recordTouch) {
        window.Analytics.recordTouch(taskNode.fields['Channel']);
      }
      taskNode.analyticsLogged = true;
    }
  }

  // Contact card background shading for a run of non-successful completed
  // Tasks - interpolates the default panel color toward dark red as the
  // streak approaches 10, resetting to 0 (default) on the next success.
  function getContactFailShade(contact) {
    var streak = (contact && contact.failedTaskStreak) || 0;
    var t = utils.clamp(streak / 10, 0, 1);
    return utils.lerpColor('#1a1b1e', '#3d1a1a', t);
  }

  // True if a Task under this Contact completed today or yesterday - drives
  // a temporary green card background (see render.js) separate from the
  // border-based "rotting" indicator.
  function isRecentlyCompleted(contact) {
    var d = contact && contact.lastTaskCompletedDate;
    if(!d) return false;
    return utils.daysBetween(d, utils.today()) <= 1;
  }

  // Roll up Note content to parent Contact's Notes field
  function rollUpNote(noteNode) {
    if(!noteNode || noteNode.template !== 'Note') return;

    var contact = findParentContact(noteNode.id);
    if(!contact) return;

    var timestamp = new Date().toLocaleString();
    var noteContent = noteNode.notes || noteNode.title || '';
    var rollUpText = timestamp + ': ' + noteContent;

    contact.notes = (contact.notes || '') + rollUpText + '\n\n';
  }

  // Legacy function - kept for compatibility but simplified
  function onStatusChange(n) {
    // No longer auto-creates recurring tasks - that behavior is removed
  }

  // Find or create Task under Contact node
  function findOrCreateTask(contactNode) {
    if(!contactNode) return null;

    // Look for existing Task in Tasks Sub-Tree first
    var tasksTree = contactNode.children.find(function(c) {
      return c.template === 'Sub-Tree' && /^Tasks$/i.test(c.title);
    });

    if(tasksTree) {
      var existingTask = tasksTree.children.find(function(c) {
        return c.template === 'Task' && c.status !== 'done';
      });
      if(existingTask) return existingTask;
    }

    // Look for direct Task child
    var directTask = contactNode.children.find(function(c) {
      return c.template === 'Task' && c.status !== 'done';
    });
    if(directTask) return directTask;

    // No Task found, create one with due date based on Contact Frequency
    var offset = utils.freqToDays(contactNode.freq) ||
                 parseInt(window.DOM.defaultOffsetInput.value) || 7;
    var dueDate = utils.advanceDate(utils.today(), offset);

    var task = newNode('Next contact', 'Task', tasksTree || contactNode);
    task.due = dueDate;
    task.status = 'todo';

    if(tasksTree) {
      tasksTree.children.push(task);
    } else {
      contactNode.children.push(task);
    }

    return task;
  }

  // Public API
  return {
    newNode: newNode,
    bfs: bfs,
    findNode: findNode,
    getVisibleIds: getVisibleIds,
    isDescendant: isDescendant,
    depthOf: depthOf,
    ensurePositions: ensurePositions,
    tidySubtree: tidySubtree,
    propagateProxyHighlights: propagateProxyHighlights,
    nextDueForCard: nextDueForCard,
    cumulativeAUM: cumulativeAUM,
    crumbsOf: crumbsOf,
    ensureTags: ensureTags,
    defaultColorForTemplate: defaultColorForTemplate,
    addChildOf: addChildOf,
    toggleHighlightCascade: toggleHighlightCascade,
    toggleFold: toggleFold,
    deleteNodeCascade: deleteNodeCascade,
    onStatusChange: onStatusChange,
    findOrCreateTask: findOrCreateTask,
    getAvailableChannels: getAvailableChannels,
    findParentContact: findParentContact,
    getContactRotColor: getContactRotColor,
    isRecentlyCompleted: isRecentlyCompleted,
    getContactFailShade: getContactFailShade,
    applyTaskCompletion: applyTaskCompletion,
    rollUpNote: rollUpNote,
    getContactDescendants: getContactDescendants,
    getContactTasks: getContactTasks,
    getContactNextOpenTask: getContactNextOpenTask
  };
})();
