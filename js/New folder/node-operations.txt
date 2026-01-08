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

  function newNode(title, tmpl, parent) {
    if(title===undefined) title="Untitled";
    if(tmpl===undefined) tmpl="";
    if(parent===undefined) parent=null;

    var effective = tmpl || (parent && parent.template) || 'Contact';
    var base = (parent && parent.pos) || {x:0,y:0};
    var tFields = (config.Templates[effective] && config.Templates[effective].fields) ?
      (function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(config.Templates[effective].fields) : {};
    if(!tFields['Tags']) tFields['Tags']='';

    var color = (parent && parent.template==='Sub-Tree') ? (parent.color||defaultColorForTemplate(effective)) : defaultColorForTemplate(effective);

    // Set default status based on template
    var defaultStatus = '';
    if (effective === 'Task') {
      defaultStatus = 'todo';
    } else if (effective === 'Contact') {
      defaultStatus = 'A-tier';
    }
    // Touch uses fields['Status'] instead of node.status

    var node = {
      id: utils.uuid(),
      title: title,
      template: effective,
      status: defaultStatus,
      due: '',
      notes: '',
      fields: tFields,
      freq: '',
      highlight: false,
      proxyHighlight: false,
      collapsed: false,
      color: color,
      anchored: false,
      children: [],
      pos: parent ? {x:base.x+280+Math.random()*60, y:base.y+(parent.children.length*90+Math.random()*40)} : {x:0,y:0}
    };

    ensureTags(node);

    // Set due date to today for Touch nodes
    if (node.template === 'Touch') {
      node.due = utils.today();
    }

    // Auto-scaffolding for Contact template - only create Tasks Sub-Tree
    if (node.template === 'Contact') {
      var tasksTree = newNode('Tasks', 'Sub-Tree', node);
      node.children.push(tasksTree);
    }

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
        n.fields['Activity Offset'] = n.fields['Activity Offset']||'';
      }

      // Touch-specific field initialization
      if(n.template==='Touch') {
        n.fields['Touch Type'] = n.fields['Touch Type']||'';
        n.fields['Status'] = n.fields['Status']||'Not Completed';
      }

      ensureTags(n);
    });
  }

  function tidySubtree(rootId) {
    var root = findNode(rootId).node;
    if(!root) return;

    var gapX = 300, gapY = 100;
    var start = depthOf(rootId);
    var origin = {x:root.pos.x, y:root.pos.y};
    var nextY = {};

    function setPos(n, depth, y) {
      n.pos.x = origin.x + (depth-start)*gapX;
      n.pos.y = y;
      if(n!==root) n.anchored = true;
    }

    function place(n, depth) {
      if(n.collapsed) {
        var y0 = (nextY[depth]!=null ? nextY[depth] : root.pos.y);
        setPos(n, depth, y0);
        nextY[depth] = y0 + gapY;
        return {top:n.pos.y, bottom:n.pos.y};
      }

      if(n.children.length===0) {
        var y = (nextY[depth]!=null ? nextY[depth] : root.pos.y);
        setPos(n, depth, y);
        nextY[depth] = y + gapY;
        return {top:y, bottom:y};
      }

      var top = Infinity, bottom = -Infinity;
      for(var i=0; i<n.children.length; i++) {
        var span = place(n.children[i], depth+1);
        top = Math.min(top, span.top);
        bottom = Math.max(bottom, span.bottom);
      }

      var mid = (top+bottom)/2;
      var y2 = Math.max(mid, (nextY[depth]!=null ? nextY[depth] : root.pos.y));
      setPos(n, depth, y2);
      nextY[depth] = y2 + gapY;
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

  // Scaffolding - ensures Contact nodes have Tasks Sub-Tree
  function ensureScaffolding() {
    bfs(state.map, function(n){
      if(n.template==='Contact') {
        var tasksTree = n.children.find(function(c){ return c.template==='Sub-Tree' && /^Tasks$/i.test(c.title); });
        if(!tasksTree) {
          tasksTree = newNode('Tasks','Sub-Tree',n);
          n.children.push(tasksTree);
        }
      }
    });
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

    // Default to Touch for Task nodes when no template explicitly selected
    if(!window.DOM.templateSelect.value && parent.template==='Task') {
      tmpl = 'Touch';
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

  // Get all Touches for a Contact (including those in Sub-Trees)
  function getContactTouches(contactNode) {
    return getContactDescendants(contactNode, 'Touch');
  }

  // Handle Touch completion - rolls up to parent Task and Contact
  function onTouchCompleted(touchNode) {
    if(!touchNode || touchNode.template !== 'Touch') return;
    if(!touchNode.fields || touchNode.fields['Status'] !== 'Completed') return;

    // 1. Find and mark parent Task as done
    var touchInfo = findNode(touchNode.id);
    var parentTask = touchInfo.parent;

    if(!parentTask || parentTask.template !== 'Task') return;

    parentTask.status = 'done';

    // 2. Find grandparent Contact
    var contact = findParentContact(parentTask.id);

    if(contact) {
      // 3. Roll up touch info to Contact's Notes
      var timestamp = new Date().toLocaleString();
      var touchType = touchNode.fields['Touch Type'] || 'Touch';
      var touchNotes = (touchNode.notes || '').split('\n')[0] || '';
      var touchInfo = timestamp + ': ' + touchType + (touchNotes ? ' - ' + touchNotes : '');

      contact.notes = (contact.notes || '') + touchInfo + '\n\n';

      // 4. Update Contact's Last Contact
      contact.fields['Last Contact'] = utils.today();

      // 5. Get Activity Offset (per-contact or global default)
      var activityOffset = parseInt(contact.fields['Activity Offset']) ||
                          parseInt(window.DOM.defaultOffsetInput.value) || 7;
      var nextDue = utils.advanceDate(utils.today(), activityOffset);

      // 6. Create new Task under Contact's Tasks Sub-Tree
      var tasksTree = contact.children.find(function(c) {
        return c.template === 'Sub-Tree' && /^Tasks$/i.test(c.title);
      });

      var newTask = newNode('Next contact', 'Task', tasksTree || contact);
      newTask.due = nextDue;
      newTask.status = 'todo';

      if(tasksTree) {
        tasksTree.children.push(newTask);
      } else {
        contact.children.push(newTask);
      }

      // 7. Update Contact's Next Contact
      contact.fields['Next Contact'] = nextDue;
    }

    // Record in analytics
    if(window.Analytics && window.Analytics.recordTouch) {
      var channel = (touchNode.fields['Touch Type'] || '').toLowerCase();
      if(channel === 'call') channel = 'calls';
      else if(channel === 'email') channel = 'emails';
      window.Analytics.recordTouch(channel);
    }
  }

  // Handle Task completion - update parent Contact
  function onTaskCompleted(taskNode) {
    if(!taskNode || taskNode.template !== 'Task') return;
    if(taskNode.status !== 'done') return;

    // Find parent Contact
    var contact = findParentContact(taskNode.id);
    if(!contact) return;

    // Update Contact's Last Contact
    contact.fields['Last Contact'] = utils.today();

    // Get Activity Offset (per-contact or global default)
    var activityOffset = parseInt(contact.fields['Activity Offset']) ||
                        parseInt(window.DOM.defaultOffsetInput.value) || 7;
    var nextDue = utils.advanceDate(utils.today(), activityOffset);

    // Create new Task under Contact's Tasks Sub-Tree
    var tasksTree = contact.children.find(function(c) {
      return c.template === 'Sub-Tree' && /^Tasks$/i.test(c.title);
    });

    var newTask = newNode('Next contact', 'Task', tasksTree || contact);
    newTask.due = nextDue;
    newTask.status = 'todo';

    if(tasksTree) {
      tasksTree.children.push(newTask);
    } else {
      contact.children.push(newTask);
    }

    // Update Contact's Next Contact
    contact.fields['Next Contact'] = nextDue;
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

  // Get aggregated touch notes for a Task
  function getTaskTouchNotes(taskNode) {
    if(!taskNode || taskNode.template !== 'Task') return [];

    return (taskNode.children || [])
      .filter(function(c) { return c.template === 'Touch'; })
      .map(function(t) {
        var notes = (t.notes || '').split('\n')[0];
        var touchType = (t.fields && t.fields['Touch Type']) || '';
        return touchType ? touchType + ': ' + notes : notes;
      })
      .filter(Boolean)
      .slice(0, 2); // Max 2 touch notes
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

    // No Task found, create one with due date based on offset
    var offset = parseInt(contactNode.fields['Activity Offset']) ||
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
    isDescendant: isDescendant,
    depthOf: depthOf,
    ensurePositions: ensurePositions,
    tidySubtree: tidySubtree,
    propagateProxyHighlights: propagateProxyHighlights,
    nextDueForCard: nextDueForCard,
    crumbsOf: crumbsOf,
    ensureScaffolding: ensureScaffolding,
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
    onTouchCompleted: onTouchCompleted,
    onTaskCompleted: onTaskCompleted,
    rollUpNote: rollUpNote,
    getTaskTouchNotes: getTaskTouchNotes,
    getContactDescendants: getContactDescendants,
    getContactTasks: getContactTasks,
    getContactTouches: getContactTouches
  };
})();
