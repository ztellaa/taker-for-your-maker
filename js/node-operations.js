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

    var effective = tmpl || (parent && parent.template) || 'Client';
    var base = (parent && parent.pos) || {x:0,y:0};
    var tFields = (config.Templates[effective] && config.Templates[effective].fields) ?
      (function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(config.Templates[effective].fields) : {};
    if(!tFields['Tags']) tFields['Tags']='';

    var color = (parent && parent.template==='Sub-Tree') ? (parent.color||defaultColorForTemplate(effective)) : defaultColorForTemplate(effective);
    var defaultStatus = (effective==='Task'||effective==='Recurring Contact') ? 'todo' : (['Client','COI','Opportunity'].indexOf(effective)!==-1 ? 'A-tier' : '');

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

    if(['Client','COI'].indexOf(node.template)!==-1) {
      var rcTree = newNode('Recurring Contacts','Sub-Tree',node);
      var rc = newNode('Recurring Contact','Recurring Contact',rcTree);
      rc.fields['Frequency'] = node.freq || 'quarterly';
      var daysMap = {monthly:30,quarterly:90,biannually:182,annually:365};
      var days = daysMap[rc.fields['Frequency']]||90;
      rc.due = new Date(Date.now()+days*86400000).toISOString().slice(0,10);
      rcTree.children.push(rc);
      var tasksTree = newNode('Tasks','Sub-Tree',node);
      node.children.push(rcTree, tasksTree);
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
      if(!n.color) n.color = defaultColorForTemplate(n.template||'Client');
      if(typeof n.collapsed!=='boolean') n.collapsed = false;
      if(typeof n.anchored!=='boolean') n.anchored = false;
      if(typeof n.proxyHighlight!=='boolean') n.proxyHighlight = false;
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
      n.pos.x = origin.x + (depth-start)*gapX + colOffset*gapX;
      n.pos.y = y + (colOffset * maxPerColumn * gapY);
      if(n!==root) n.anchored = true;
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
    var direct = (n.children||[]).filter(function(c){ return c.template==='Task'||c.template==='Recurring Contact'; });
    var fromSubtrees = (n.children||[]).filter(function(c){ return c.template==='Sub-Tree'; }).flatMap(function(st){
      return (st.children||[]).filter(function(x){ return x.template==='Task'||x.template==='Recurring Contact'; });
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

  // Scaffolding
  function ensureScaffolding() {
    bfs(state.map, function(n){
      if(n.template==='Client'||n.template==='COI') {
        var rcTree = n.children.find(function(c){ return c.template==='Sub-Tree' && /^Recurring Contacts$/i.test(c.title); });
        if(!rcTree) {
          rcTree = newNode('Recurring Contacts','Sub-Tree',n);
          n.children.unshift(rcTree);
        }

        var stray = n.children.filter(function(c){ return c.template==='Recurring Contact'; });
        stray.forEach(function(c){
          n.children = n.children.filter(function(x){ return x!==c; });
          rcTree.children.push(c);
        });

        if(rcTree.children.filter(function(c){ return c.template==='Recurring Contact'; }).length===0) {
          var rc = newNode('Recurring Contact','Recurring Contact',rcTree);
          rc.fields['Frequency'] = n.freq||'quarterly';
          var daysMap = {monthly:30,quarterly:90,biannually:182,annually:365};
          var days = daysMap[rc.fields['Frequency']]||90;
          rc.due = new Date(Date.now()+days*86400000).toISOString().slice(0,10);
          rcTree.children.push(rc);
        }

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

    var tmpl = window.DOM.templateSelect.value || parent.template || 'Client';
    if(!window.DOM.templateSelect.value && (parent.template==='Account'||parent.template==='Opportunity'||parent.template==='COI'||parent.template==='Client')) {
      tmpl = 'Task';
    }

    var child = newNode(tmpl?tmpl:'New node', tmpl, parent);

    if((tmpl==='Task'||tmpl==='Recurring Contact') && !child.due) {
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
      state.map = newNode('Root','Client',null);
      state.map.pos = {x:0,y:0};
      state.selectedId = state.map.id;
    } else {
      parent.children = parent.children.filter(function(c){ return c.id!==id; });
      state.selectedId = parent.id;
    }
  }

  // Recurring contact
  function tapRecurringFor(id) {
    var node = findNode(id).node;
    if(!node) return;
    ensureScaffolding();

    var rcTree = node.children.find(function(c){ return c.template==='Sub-Tree' && /^Recurring Contacts$/i.test(c.title); });
    if(!rcTree) {
      rcTree = newNode('Recurring Contacts','Sub-Tree',node);
      node.children.unshift(rcTree);
    }

    var list = rcTree.children.filter(function(c){ return c.template==='Recurring Contact'; });
    if(list.length===0) {
      var first = newNode('Recurring Contact','Recurring Contact',rcTree);
      first.fields['Frequency'] = node.freq||'quarterly';
      first.due = utils.advanceDate(utils.today(), utils.freqToDays(first.fields['Frequency']));
      rcTree.children.push(first);
      list = [first];
    }

    list.sort(function(a,b){ return (a.due||'9999-12-31').localeCompare(b.due||'9999-12-31'); });
    var cur = list.find(function(x){ return x.status!=='done'; }) || list[0];
    if(!cur.due) cur.due = utils.today();

    var prevStatus = cur.status;
    cur.status = 'done';
    if(prevStatus!=='done') onStatusChange(cur);
  }

  function onStatusChange(n) {
    if((n.template==='Recurring Contact'||n.template==='Task') && (n.freq||n.fields['Frequency']) && n.status==='done') {
      var parent = findNode(n.id).parent;
      if(!parent) return;

      var freq = n.freq || n.fields['Frequency'];
      var next = newNode(n.title, n.template, parent);
      next.freq = freq;
      next.fields = (function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(n.fields);
      next.due = utils.advanceDate(n.due||utils.today(), utils.freqToDays(freq));
      parent.children.push(next);
    }
  }

  // Touch function
  function randomNodeColor(tmpl) {
    try {
      if(Array.isArray(config.Palette) && config.Palette.length) {
        return config.Palette[Math.floor(Math.random()*config.Palette.length)];
      }
    } catch(e) {}
    return defaultColorForTemplate(tmpl||'Note');
  }

  function touchCurrent(channel) {
    if(!state.selectedId) return { success: false, reason: 'no-selection' };
    var f = findNode(state.selectedId);
    if(!f || !f.node) return { success: false, reason: 'node-not-found' };

    var n = f.node;

    // Only allow touch on Task nodes
    if(n.template !== 'Task') {
      return { success: false, reason: 'not-task' };
    }

    if(!n.fields) n.fields = {};
    n.fields['Last Contact'] = utils.today();

    // Map channel to display name
    var channelNames = {
      calls: '📞 Call',
      linkedin: '💼 LinkedIn',
      emails: '📧 Email'
    };
    var channelDisplay = channelNames[channel] || 'Touch';

    var note = newNode(channelDisplay + ' - ' + utils.today(), 'Note', n);
    note.color = randomNodeColor('Note');
    note.notes = 'Touched on ' + utils.today() + ' via ' + channelDisplay;
    n.children = n.children || [];
    n.children.push(note);

    // Record in analytics
    if(window.Analytics && window.Analytics.recordTouch) {
      window.Analytics.recordTouch(channel);
    }

    return { success: true, noteId: note.id };
  }

  // Find or create Task under Opportunity/COI node
  function findOrCreateTask(opportunityNode) {
    if(!opportunityNode) return null;

    // Look for existing Task directly under this node
    var existingTask = opportunityNode.children.find(function(c) {
      return c.template === 'Task';
    });

    if(existingTask) return existingTask;

    // No Task found, create one with due date = tomorrow
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = tomorrow.toISOString().slice(0,10);

    var task = newNode('Follow-up', 'Task', opportunityNode);
    task.due = tomorrowStr;
    task.status = 'todo';

    opportunityNode.children.push(task);
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
    cumulativeAUM: cumulativeAUM,
    crumbsOf: crumbsOf,
    ensureScaffolding: ensureScaffolding,
    ensureTags: ensureTags,
    defaultColorForTemplate: defaultColorForTemplate,
    addChildOf: addChildOf,
    toggleHighlightCascade: toggleHighlightCascade,
    toggleFold: toggleFold,
    deleteNodeCascade: deleteNodeCascade,
    tapRecurringFor: tapRecurringFor,
    onStatusChange: onStatusChange,
    touchCurrent: touchCurrent,
    findOrCreateTask: findOrCreateTask
  };
})();
