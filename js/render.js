// Rendering Functions
window.Render = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;

  function clearLayers() {
    dom.nodeLayer.innerHTML = '';
    dom.linkLayer.innerHTML = '';
  }

  function updateStats() {
    var clients = 0, aum = 0, tasks = 0, opps = 0;
    nodeOps.bfs(state.map, function(n) {
      if(n.template==='Client') clients++;
      if(n.template==='Opportunity') opps++;
      if((n.template==='Task'||n.template==='Recurring Contact') && n.status!=='done') tasks++;
      if(n.fields && n.fields['AUM']) {
        var val = parseFloat(String(n.fields['AUM']).replace(/[^0-9.-]/g,''))||0;
        aum += val;
      }
    });
    dom.statClients.textContent = clients;
    dom.statAUM.textContent = utils.formatCurrency(aum);
    dom.statTasks.textContent = tasks;
    dom.statOpps.textContent = opps;
  }

  function highlightSelection() {
    utils.$$('.node', dom.nodeLayer).forEach(function(el) {
      var on = el.dataset.id === state.selectedId;
      el.style.outline = on ? '2px solid var(--rbc-light-blue)' : 'none';
      el.style.outlineOffset = on ? '2px' : '0';
    });
  }

  function selectNode(id) {
    state.selectedId = id;
    highlightSelection();
  }

  function drawLinks(cardMap, visible) {
    dom.linkLayer.innerHTML = '';
    var g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('fill','none');
    dom.linkLayer.appendChild(g);

    nodeOps.bfs(state.map, function(n,p) {
      if(!p) return;
      if(!visible.has(n.id) || !visible.has(p.id)) return;

      var nodeW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--node-w'))||260;
      var pe = cardMap.get(p.id), ce = cardMap.get(n.id);
      var y1 = p.pos.y + (((pe&&pe.offsetHeight)||80)/2);
      var y2 = n.pos.y + (((ce&&ce.offsetHeight)||80)/2);
      var x1 = p.pos.x + nodeW, x2 = n.pos.x, mid = (x1+x2)/2;

      var path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M '+x1+' '+y1+' C '+mid+' '+y1+', '+mid+' '+y2+', '+x2+' '+y2);
      path.setAttribute('opacity','0.5');
      var color = utils.shade(nodeOps.findNode(p.id).node.color, -0.4);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width','2');
      g.appendChild(path);
    });
  }

  function renderMindMap() {
    if(!state.map) {
      clearLayers();
      return;
    }

    nodeOps.ensurePositions();
    nodeOps.propagateProxyHighlights();
    clearLayers();
    updateStats();

    var visible = new Set();
    (function walk(n) {
      visible.add(n.id);
      if(n.collapsed) return;
      n.children.forEach(walk);
    })(state.map);

    var cardMap = new Map();

    nodeOps.bfs(state.map, function(n,p,depth) {
      if(!visible.has(n.id)) return;

      var card = document.createElement('div');
      var highlightCls = n.highlight ? ' highlight' : (n.proxyHighlight ? ' proxy-highlight' : '');
      var subtreeCls = n.template==='Sub-Tree' ? ' subtree' : '';
      card.className = 'node' + highlightCls + subtreeCls;
      card.style.left = n.pos.x + 'px';
      card.style.top = n.pos.y + 'px';
      card.dataset.id = n.id;
      card.style.borderColor = utils.shade(n.color, -0.2);

      var typeChip = '<span class="chip"><span class="swatch" style="background:'+(config.TemplateChipColors[n.template]||'#6b7280')+'"></span>'+utils.esc(n.template)+'</span>';
      var collapsedChip = n.collapsed ? '<span class="badge" title="Collapsed">▸</span>' : '';

      var sfUrl = (n.fields && (n.fields['Salesforce']||'').trim()) || '';
      var sfChip = (['Client','COI','Opportunity'].indexOf(n.template)!==-1 && /^https?:\/\//i.test(sfUrl)) ? ' <a class="chip sf" href="'+utils.esc(sfUrl)+'" target="_blank" rel="noopener">Salesforce</a>' : '';
      var webUrl = (n.fields && (n.fields['Web']||'').trim()) || '';
      var liUrl = (n.fields && (n.fields['LinkedIn']||'').trim()) || '';
      var webChip = /^https?:\/\//i.test(webUrl) ? ' <a class="chip sf" href="'+utils.esc(webUrl)+'" target="_blank" rel="noopener">Web</a>' : '';
      var liChip = /^https?:\/\//i.test(liUrl) ? ' <a class="chip sf" href="'+utils.esc(liUrl)+'" target="_blank" rel="noopener">LinkedIn</a>' : '';

      var bodyHTML = '';
      if(config.Templates[n.template] && config.Templates[n.template].show) {
        bodyHTML = config.Templates[n.template].show(n, depth);
      } else {
        bodyHTML = '<strong>'+utils.esc(n.title)+'</strong>';
      }

      var nextTask = nodeOps.nextDueForCard(n);
      var todoLine = nextTask ? '<div class="meta"><span>Next task: '+utils.formatDateDisplay(nextTask)+'</span></div>' : '';

      var doneChip = (n.status==='done') ? ' <span class="badge" title="Done">✓</span>' : '';
      var titleHTML = '<div class="title" style="font-size:'+(n.template==='Sub-Tree'?Math.max(16,28-depth*2)+'px':'15px')+'">'+bodyHTML+' '+typeChip+' '+collapsedChip+sfChip+webChip+liChip+doneChip+'</div>';

      // Build meta section with contact dates for Client, COI, Opportunity
      var metaFragments = [];

      // Add contact dates for Client, COI, Opportunity
      if(['Client','COI','Opportunity'].indexOf(n.template)!==-1) {
        var lastContact = (n.fields && n.fields['Last Contact']) || '';
        var nextContact = (n.fields && n.fields['Next Contact']) || '';
        if(lastContact) metaFragments.push('<span>Last: '+utils.formatDateDisplay(lastContact)+'</span>');
        if(nextContact) {
          var isOverdueContact = false;
          if(nextContact) {
            var contactDate = new Date(utils.normalizeDate(nextContact));
            var today = new Date();
            today.setHours(0,0,0,0);
            isOverdueContact = contactDate < today;
          }
          if(isOverdueContact) {
            metaFragments.push('<span class="badge danger">⚠ Next: '+utils.formatDateDisplay(nextContact)+'</span>');
          } else {
            metaFragments.push('<span>Next: '+utils.formatDateDisplay(nextContact)+'</span>');
          }
        }
      }

      // Add status for Client, COI, Opportunity
      var showStatus = ['Client','COI','Opportunity'].indexOf(n.template)!==-1;
      if(showStatus && n.status) metaFragments.push('<span>'+utils.labelStatus(n.status)+'</span>');

      // Add due dates for tasks
      var childDue = (n.children||[]).map(function(c){ return c.due; }).filter(Boolean).sort()[0];
      var showDue = !!n.due || !!childDue;
      if(showDue) {
        var dueFrag = '';
        var isOverdue = false;
        if(n.due && n.status !== 'done') {
          var dueDate = new Date(n.due);
          var today = new Date();
          today.setHours(0,0,0,0);
          isOverdue = dueDate < today;
        }
        if(isOverdue) {
          dueFrag = '<span class="badge danger">⚠ Due: '+utils.formatDateDisplay(n.due)+'</span>';
        } else if(n.due) {
          dueFrag = '<span>Due: '+utils.formatDateDisplay(n.due)+'</span>';
        } else if(childDue) {
          dueFrag = '<span>Next: '+utils.formatDateDisplay(childDue)+'</span>';
        }
        if(dueFrag) metaFragments.push(dueFrag);
      }

      // Add notes preview
      if(n.notes) metaFragments.push('<span>📝 '+utils.esc(n.notes).slice(0,40)+(n.notes.length>40?'…':'')+'</span>');

      var meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = metaFragments.join(' ');

      var kv = null;
      if(n.template!=='Sub-Tree') {
        kv = document.createElement('div');
        kv.className = 'kv';
        kv.innerHTML = Object.keys(n.fields||{}).length ?
          Object.entries(n.fields).filter(function(entry){
            return ['Last Contact','Next Contact'].indexOf(entry[0])===-1;
          }).slice(0,4).map(function(entry){
            return '<div><strong>'+utils.esc(entry[0])+':</strong> '+utils.esc(String(entry[1]))+'</div>';
          }).join('') :
          '<em style="color:var(--muted)">No record fields</em>';
      }

      var actions = document.createElement('div');
      actions.className = 'actions';
      actions.innerHTML =
        '<button class="btn" data-act="child" type="button">Child</button>'+
        '<button class="btn" data-act="add" type="button">+Child</button>'+
        '<button class="btn" data-act="fold" type="button">'+(n.collapsed?'Unfold':'Fold')+'</button>'+
        '<button class="btn" data-act="edit" type="button">Edit</button>'+
        (n.template==='Task'?'<button class="btn" data-act="tap" type="button">Touch</button>':'')+
        '<button class="btn" data-act="hl" type="button">'+(n.highlight?'Unflag':'Flag')+'</button>'+
        '<button class="btn danger" data-act="del" type="button">Delete</button>';

      card.innerHTML = titleHTML + todoLine;
      card.appendChild(meta);
      if(kv) card.appendChild(kv);
      card.appendChild(actions);
      dom.nodeLayer.appendChild(card);
      cardMap.set(n.id, card);
    });

    drawLinks(cardMap, visible);
    highlightSelection();
  }

  function buildList() {
    dom.taskList.innerHTML = '';
    if(!state.map) return;

    var rows = [];
    nodeOps.bfs(state.map, function(n) {
      // Add tasks and recurring contacts
      if((n.template==='Task'||n.template==='Recurring Contact') && n.due) {
        rows.push({
          id: n.id,
          title: n.title||'Untitled',
          crumbs: nodeOps.crumbsOf(n.id).join(' / ')||'Root',
          status: n.status||'todo',
          due: n.due||'',
          highlight: !!n.highlight
        });
      }
      // Add next contacts for Opportunity, Client, and COI
      if(['Opportunity','Client','COI'].indexOf(n.template)!==-1) {
        var next = (n.fields||{})['Next Contact'];
        if(next) {
          rows.push({
            id: n.id,
            title: 'Contact: '+n.title,
            crumbs: nodeOps.crumbsOf(n.id).join(' / ')||'Root',
            status: 'todo',
            due: utils.normalizeDate(next),
            highlight: !!n.highlight
          });
        }
      }
    });

    var tstr = utils.today();
    var now = new Date(tstr);
    var pred = function(r) {
      var due = r.due ? new Date(utils.normalizeDate(r.due)) : null;
      var isOverdue = due && due < now && r.status!=='done';
      if(state.listFilter==='now') return isOverdue || r.status==='todo';
      if(state.listFilter==='todo') return r.status==='todo';
      if(state.listFilter==='inprogress') return r.status==='inprogress';
      if(state.listFilter==='blocked') return r.status==='blocked';
      if(state.listFilter==='done') return r.status==='done';
      if(state.listFilter==='overdue') return isOverdue;
      return true;
    };

    rows = rows.filter(pred);
    var key = dom.listSort.value;
    rows.sort(function(a,b) {
      if(key==='title') return a.title.localeCompare(b.title);
      if(key==='status') return a.status.localeCompare(b.status);
      if(key==='due') {
        var av = a.due ? new Date(a.due) : null;
        var bv = b.due ? new Date(b.due) : null;
        if(!av&&!bv) return 0;
        if(!av) return 1;
        if(!bv) return -1;
        return av - bv;
      }
      return 0;
    });

    rows.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'row';
      row.dataset.id = r.id;

      // Check if overdue
      var isOverdue = false;
      if(r.due && r.status !== 'done') {
        var dueDate = new Date(utils.normalizeDate(r.due));
        var today = new Date();
        today.setHours(0,0,0,0);
        isOverdue = dueDate < today;
      }

      var dueBadgeClass = isOverdue ? 'badge danger' : 'badge';
      var dueBadgeText = isOverdue ? '⚠ '+utils.formatDateDisplay(r.due) : utils.formatDateDisplay(r.due);

      row.innerHTML = '<div style="width:10px">'+(r.highlight?'🚩':'')+'</div><div><div class=title>'+utils.esc(r.title)+'</div><div class=crumbs>'+utils.esc(r.crumbs)+'</div></div><div class=right><span class=badge>'+utils.labelStatus(r.status)+'</span><span class="'+dueBadgeClass+'">'+(r.due?dueBadgeText:'No due')+'</span><button class=btn data-act=open type=button>Open</button></div>';

      row.addEventListener('click', function(e) {
        if(e.target && e.target.dataset && e.target.dataset.act==='open') {
          selectNode(r.id);
          window.Events.switchToMind();
          setTimeout(function() {
            window.Editor.openEditor(r.id);
          }, 0);
        } else {
          selectNode(r.id);
          window.Events.switchToMind();
        }
      });

      dom.taskList.appendChild(row);
    });
  }

  // Public API
  return {
    renderMindMap: renderMindMap,
    drawLinks: drawLinks,
    buildList: buildList,
    updateStats: updateStats,
    clearLayers: clearLayers,
    highlightSelection: highlightSelection,
    selectNode: selectNode
  };
})();
