// Event Handlers
window.Events = (function() {
  var utils = window.Utils;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;

  // View toggles
  function switchToMind() {
    dom.viewMindBtn.classList.add('active');
    dom.viewListBtn.classList.remove('active');
    dom.mindmapView.classList.add('active');
    dom.listView.classList.remove('active');
  }

  function switchToList() {
    dom.viewListBtn.classList.add('active');
    dom.viewMindBtn.classList.remove('active');
    dom.listView.classList.add('active');
    dom.mindmapView.classList.remove('active');
    state.listFilter = 'now';
    utils.$('#statusFilters .btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.filter==='now');
    });
    window.Render.buildList();
  }

  // Transform & zoom
  function stageTransform() {
    dom.stage.style.transform = 'translate('+state.tx+'px, '+state.ty+'px) scale('+state.zoom+')';
    utils.$('#zoomReset').textContent = Math.round(state.zoom*100)+'%';
  }

  function applyZoom(mult) {
    var rect = dom.stage.getBoundingClientRect();
    var cx = rect.width/2, cy = rect.height/2;
    var px = (cx-rect.left-state.tx)/state.zoom;
    var py = (cy-rect.top-state.ty)/state.zoom;
    var newZoom = utils.clamp(state.zoom*mult, 0.3, 4);
    state.tx = cx - px*newZoom - rect.left;
    state.ty = cy - py*newZoom - rect.top;
    state.zoom = newZoom;
    stageTransform();
  }

  // Arrow-key navigation helpers
  function isTypingTarget(el) {
    return el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable);
  }

  function moveSelection(dir) {
    if(!state.selectedId || !state.map) return;
    var fp = nodeOps.findNode(state.selectedId);
    if(!fp || !fp.node) return;

    var node = fp.node, parent = fp.parent;

    if(dir==='left') {
      if(parent) {
        window.Render.selectNode(parent.id);
        window.Render.highlightSelection();
      }
      return;
    }

    if(dir==='right') {
      if(node.children && node.children.length) {
        window.Render.selectNode(node.children[0].id);
        window.Render.highlightSelection();
      }
      return;
    }

    if(!parent) return;
    var sibs = parent.children || [];
    var idx = sibs.findIndex(function(c){ return c.id===node.id; });
    if(idx===-1) return;

    if(dir==='up' && idx>0) {
      window.Render.selectNode(sibs[idx-1].id);
      window.Render.highlightSelection();
    }
    if(dir==='down' && idx<sibs.length-1) {
      window.Render.selectNode(sibs[idx+1].id);
      window.Render.highlightSelection();
    }
  }

  // Event handlers initialization
  function initWheelZoom() {
    dom.stageWrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = dom.stage.getBoundingClientRect();
      var worldX = (e.clientX-rect.left-state.tx)/state.zoom;
      var worldY = (e.clientY-rect.top-state.ty)/state.zoom;
      var base = (e.deltaMode===1 ? 15 : (e.deltaMode===2 ? 360 : 1));
      var delta = e.deltaY * base;
      var factor = Math.pow(1.0012, -delta);
      var newZoom = utils.clamp(state.zoom*factor, 0.3, 4);
      state.tx = e.clientX - worldX*newZoom - rect.left;
      state.ty = e.clientY - worldY*newZoom - rect.top;
      state.zoom = newZoom;
      stageTransform();
    }, {passive:false});
  }

  function initPanning() {
    dom.stageWrap.addEventListener('pointerdown', function(e) {
      if(e.button!==0) return;
      if(e.target.closest('.node')) return;
      state.isPanning = true;
      state.panStart = {x:e.clientX, y:e.clientY, tx:state.tx, ty:state.ty};
      dom.stageWrap.setPointerCapture(e.pointerId);
    });

    dom.stageWrap.addEventListener('pointermove', function(e) {
      if(!state.isPanning) return;
      var dx = e.clientX - state.panStart.x;
      var dy = e.clientY - state.panStart.y;
      state.tx = state.panStart.tx + dx;
      state.ty = state.panStart.ty + dy;
      stageTransform();
    });

    dom.stageWrap.addEventListener('pointerup', function() {
      state.isPanning = false;
    });

    dom.stageWrap.addEventListener('pointercancel', function() {
      state.isPanning = false;
    });
  }

  function initDragAndDrop() {
    dom.nodeLayer.addEventListener('pointerdown', function(e) {
      var card = e.target.closest('.node');
      if(!card) return;
      if(e.button!==0) return;
      if(e.target.closest('.btn, input, textarea, select, a[href], [role="link"]')) return;

      var id = card.dataset.id;
      window.Render.selectNode(id);
      var rect = dom.stage.getBoundingClientRect();
      var localX = (e.clientX-rect.left)/state.zoom;
      var localY = (e.clientY-rect.top)/state.zoom;
      var node = nodeOps.findNode(id).node;
      state.drag = {id:id, offX:localX-node.pos.x, offY:localY-node.pos.y};
      state.dragStartPos = {x:e.clientX, y:e.clientY};
      card.classList.add('dragging');
      if(card.setPointerCapture) card.setPointerCapture(e.pointerId);
      node.anchored = false;
    });

    dom.nodeLayer.addEventListener('pointermove', function(e) {
      if(!state.drag) return;
      var rect = dom.stage.getBoundingClientRect();
      var localX = (e.clientX-rect.left)/state.zoom;
      var localY = (e.clientY-rect.top)/state.zoom;
      var node = nodeOps.findNode(state.drag.id).node;
      var prevX = node.pos.x, prevY = node.pos.y;
      node.pos.x = localX - state.drag.offX;
      node.pos.y = localY - state.drag.offY;
      var dx = node.pos.x - prevX, dy = node.pos.y - prevY;

      (function moveAnchored(n) {
        n.children.forEach(function(c) {
          if(c.anchored) {
            c.pos.x += dx;
            c.pos.y += dy;
            moveAnchored(c);
          }
        });
      })(node);

      var card = dom.nodeLayer.querySelector('.node[data-id="'+state.drag.id+'"]');
      if(card) {
        card.style.left = node.pos.x + 'px';
        card.style.top = node.pos.y + 'px';
      }

      window.Render.drawLinks(new Map(utils.$$('.node', dom.nodeLayer).map(function(el){
        return [el.dataset.id, el];
      })), new Set());

      window.Storage.markDirty();
    });

    dom.nodeLayer.addEventListener('pointerup', function(e) {
      if(!state.drag) return;
      var card = dom.nodeLayer.querySelector('.node[data-id="'+state.drag.id+'"]');
      if(card) card.classList.remove('dragging');

      // Calculate drag distance
      var dragDistance = 0;
      if(state.dragStartPos) {
        var dx = e.clientX - state.dragStartPos.x;
        var dy = e.clientY - state.dragStartPos.y;
        dragDistance = Math.sqrt(dx*dx + dy*dy);
      }

      // Only reparent if dragged more than 25 pixels
      if(dragDistance > 25) {
        var path = document.elementsFromPoint(e.clientX, e.clientY);
        var targetEl = path.find(function(el){
          return el.classList && el.classList.contains('node') && el.dataset.id!==state.drag.id;
        });

        if(targetEl) {
          var targetId = targetEl.dataset.id;
          if(!nodeOps.isDescendant(state.drag.id, targetId)) {
            var found = nodeOps.findNode(state.drag.id);
            var oldParent = found.parent;
            var me = found.node;

            if(oldParent && oldParent.id !== targetId) {
              window.UndoManager.capture('move', {nodeId: state.drag.id, oldParentId: oldParent.id, newParentId: targetId});
              var newParent = nodeOps.findNode(targetId).node;
              oldParent.children = oldParent.children.filter(function(c){
                return c.id !== state.drag.id;
              });
              newParent.children.push(me);
            }
          }
        }
      }

      state.drag = null;
      state.dragStartPos = null;
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    });

    dom.nodeLayer.addEventListener('pointercancel', function() {
      state.drag = null;
      state.dragStartPos = null;
    });
  }

  function initButtonHandlers() {
    // Zoom buttons
    dom.zoomInBtn.onclick = function() {
      return applyZoom(1.15);
    };

    dom.zoomOutBtn.onclick = function() {
      return applyZoom(1/1.15);
    };

    dom.zoomResetBtn.onclick = function() {
      state.zoom = 1;
      state.tx = 40;
      state.ty = 45;
      stageTransform();
    };

    // Main action buttons
    dom.addRootBtn.onclick = function() {
      if(state.map && !confirm('Start a new map? Current map will be replaced.')) return;
      state.map = nodeOps.newNode('Root','Client',null);
      state.map.pos = {x:0,y:0};
      state.selectedId = state.map.id;
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    };

    dom.addChildBtn.onclick = function() {
      if(!state.selectedId) return;
      var hadTemplate = !!dom.templateSelect.value;
      window.UndoManager.capture('add', {parentId: state.selectedId, template: dom.templateSelect.value});
      var childId = nodeOps.addChildOf(state.selectedId);
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();

      if(hadTemplate && childId) {
        var node = nodeOps.findNode(state.selectedId).node;
        var created = node.children[node.children.length-1];
        if(created) {
          window.Render.selectNode(created.id);
          window.Editor.openEditor(created.id);
        }
      }
    };

    dom.editNodeBtn.onclick = function() {
      if(!state.selectedId) return;
      window.Editor.openEditor(state.selectedId);
    };

    dom.toggleHighlightBtn.onclick = function() {
      if(!state.selectedId) return;
      window.UndoManager.capture('highlight', {nodeId: state.selectedId});
      nodeOps.toggleHighlightCascade(state.selectedId);
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    };

    dom.foldBtn.onclick = function() {
      if(!state.selectedId) return;
      window.UndoManager.capture('fold', {nodeId: state.selectedId});
      nodeOps.toggleFold(state.selectedId);
      window.Storage.markDirty();
      window.Render.renderMindMap();
    };

    dom.deleteNodeBtn.onclick = function() {
      if(!state.selectedId) return;
      var node = nodeOps.findNode(state.selectedId).node;
      window.UndoManager.capture('delete', {nodeId: state.selectedId, title: node ? node.title : ''});
      nodeOps.deleteNodeCascade(state.selectedId);
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    };

    dom.distributeBtn.onclick = function() {
      if(!state.selectedId) return;
      nodeOps.tidySubtree(state.selectedId);
      window.Storage.markDirty();
      window.Render.renderMindMap();
    };

    // Save/Load buttons
    dom.saveBtn.onclick = function() {
      return window.Storage.downloadCurrent();
    };

    dom.loadBtn.onclick = function() {
      return dom.fileInput.click();
    };

    dom.fileInput.onchange = function(e) {
      var file = e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var data = JSON.parse(reader.result);
          window.Storage.applyLoaded(data);
        } catch(err) {
          alert('Could not load file. '+err.message);
        }
      };
      reader.readAsText(file);
      dom.fileInput.value = '';
    };

    // Expand/Collapse all
    utils.$('#expandAll').onclick = function() {
      nodeOps.bfs(state.map, function(n){ n.collapsed = false; });
      window.Storage.markDirty();
      window.Render.renderMindMap();
    };

    utils.$('#collapseAll').onclick = function() {
      nodeOps.bfs(state.map, function(n){ n.collapsed = true; });
      state.map.collapsed = false;
      window.Storage.markDirty();
      window.Render.renderMindMap();
    };
  }

  function initNodeClickHandlers() {
    // Touch shortcut handler
    dom.nodeLayer.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-act="tap"]');
      if(!btn) return;
      var nodeEl = e.target.closest('.node');
      if(nodeEl && nodeEl.dataset && nodeEl.dataset.id) {
        window.Render.selectNode(nodeEl.dataset.id);
      }
      e.preventDefault();
      e.stopPropagation();
      nodeOps.touchCurrent();
      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    }, true);

    // General node click handler
    dom.nodeLayer.addEventListener('click', function(e) {
      if(e.target && e.target.closest('a[href]')) {
        return;
      }

      var nodeEl = e.target.closest('.node');
      if(!nodeEl) return;

      var id = nodeEl.dataset.id;
      window.Render.selectNode(id);

      var btn = e.target.closest('.btn');
      if(!btn) return;

      e.preventDefault();
      e.stopPropagation();

      var act = btn.dataset.act;

      if(act==='add') {
        window.UndoManager.capture('add', {parentId: id});
        nodeOps.addChildOf(id);
        window.Storage.markDirty();
        window.Render.renderMindMap();
        window.Render.buildList();
      }

      if(act==='edit') {
        window.Editor.openEditor(id);
      }

      if(act==='hl') {
        window.UndoManager.capture('highlight', {nodeId: id});
        nodeOps.toggleHighlightCascade(id);
        window.Storage.markDirty();
        window.Render.renderMindMap();
        window.Render.buildList();
      }

      if(act==='del') {
        var node = nodeOps.findNode(id).node;
        window.UndoManager.capture('delete', {nodeId: id, title: node ? node.title : ''});
        nodeOps.deleteNodeCascade(id);
        window.Storage.markDirty();
        window.Render.renderMindMap();
        window.Render.buildList();
      }

      if(act==='fold') {
        window.UndoManager.capture('fold', {nodeId: id});
        nodeOps.toggleFold(id);
        window.Storage.markDirty();
        window.Render.renderMindMap();
      }

      if(act==='tap') {
        nodeOps.tapRecurringFor(id);
        window.Storage.markDirty();
        window.Render.renderMindMap();
        window.Render.buildList();
      }

      if(act==='child') {
        var node = nodeOps.findNode(id).node;
        if(!node) return;

        if(node.children.length===0) {
          nodeOps.addChildOf(id);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          window.Render.buildList();
          return;
        }

        var last = state.childCycleIndex.has(id) ? state.childCycleIndex.get(id) : -1;
        var next = (last+1) % node.children.length;
        state.childCycleIndex.set(id, next);
        window.Render.selectNode(node.children[next].id);
        window.Render.highlightSelection();
      }
    });
  }

  function initKeyboardShortcuts() {
    // Arrow keys and touch shortcut
    window.addEventListener('keydown', function(e) {
      if(isTypingTarget(e.target)) return;

      if(e.key==='ArrowUp') {
        moveSelection('up');
        e.preventDefault();
      } else if(e.key==='ArrowDown') {
        moveSelection('down');
        e.preventDefault();
      } else if(e.key==='ArrowLeft') {
        moveSelection('left');
        e.preventDefault();
      } else if(e.key==='ArrowRight') {
        moveSelection('right');
        e.preventDefault();
      } else if(e.key==='t' || e.key==='T') {
        nodeOps.touchCurrent();
        window.Storage.markDirty();
        window.Render.renderMindMap();
        window.Render.buildList();
        e.preventDefault();
      }
    }, true);

    // General keyboard shortcuts
    window.addEventListener('keydown', function(e) {
      if(e.target.matches('input, textarea, select')) return;

      if(e.key==='f' || e.key==='F') {
        if(state.selectedId) {
          window.UndoManager.capture('fold', {nodeId: state.selectedId});
          nodeOps.toggleFold(state.selectedId);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          e.preventDefault();
        }
      }

      if(e.key==='Delete') {
        if(state.selectedId) {
          var node = nodeOps.findNode(state.selectedId).node;
          window.UndoManager.capture('delete', {nodeId: state.selectedId, title: node ? node.title : ''});
          nodeOps.deleteNodeCascade(state.selectedId);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          window.Render.buildList();
          e.preventDefault();
        }
      }

      // Undo: Ctrl+Z
      if(e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        window.UndoManager.undo();
        e.preventDefault();
        return;
      }

      // Redo: Ctrl+Shift+Z
      if(e.ctrlKey && e.shiftKey && e.key === 'Z') {
        window.UndoManager.redo();
        e.preventDefault();
        return;
      }

      if(e.key==='e' || e.key==='E') {
        if(state.selectedId) {
          window.Editor.openEditor(state.selectedId);
          e.preventDefault();
        }
      }

      if(e.key==='c' || e.key==='C') {
        if(state.selectedId) {
          window.UndoManager.capture('add', {parentId: state.selectedId});
          nodeOps.addChildOf(state.selectedId);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          window.Render.buildList();
          e.preventDefault();
        }
      }

      if(e.key==='d' || e.key==='D') {
        if(state.selectedId) {
          nodeOps.tidySubtree(state.selectedId);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          e.preventDefault();
        }
      }

      if(e.key==='h' || e.key==='H') {
        if(state.selectedId) {
          window.UndoManager.capture('highlight', {nodeId: state.selectedId});
          nodeOps.toggleHighlightCascade(state.selectedId);
          window.Storage.markDirty();
          window.Render.renderMindMap();
          window.Render.buildList();
          e.preventDefault();
        }
      }
    });
  }

  function initSearch() {
    var lastQuery = '';

    function haystack(n) {
      var parts = [
        n.title||'',
        n.template||'',
        n.status||'',
        n.due||'',
        n.notes||'',
        (n.fields&&n.fields['Tags'])||''
      ];
      if(n.fields) {
        try {
          for(var k in n.fields) {
            if(Object.prototype.hasOwnProperty.call(n.fields,k)) {
              parts.push(String(n.fields[k]));
            }
          }
        } catch(e) {}
      }
      return parts.join(' ').toLowerCase();
    }

    function applyFilter(q) {
      q = (q||'').trim().toLowerCase();
      lastQuery = q;
      var firstHit = null;

      utils.$$('.node', dom.nodeLayer).forEach(function(el) {
        var id = el.dataset.id;
        var node = nodeOps.findNode(id).node;
        var match = !q || haystack(node).indexOf(q)!==-1;
        el.style.filter = match ? 'none' : 'grayscale(0.2)';
        el.style.opacity = match ? '1' : '0.45';
        if(!firstHit && match) firstHit = el;
      });

      if(firstHit) {
        var rect = firstHit.getBoundingClientRect();
        if(rect) {
          window.Render.selectNode(firstHit.dataset.id);
          window.Render.highlightSelection();
        }
      }
    }

    if(dom.searchInput) {
      dom.searchInput.addEventListener('input', function() {
        applyFilter(this.value);
      });

      dom.searchInput.addEventListener('keydown', function(e) {
        if(e.key==='Enter') {
          applyFilter(this.value);
          e.preventDefault();
        }
        if(e.key==='Escape') {
          this.value = '';
          applyFilter('');
        }
      });
    }
  }

  function initViewToggles() {
    dom.viewMindBtn.onclick = switchToMind;
    dom.viewListBtn.onclick = switchToList;

    dom.statusFilters.addEventListener('click', function(e) {
      var b = e.target.closest('button');
      if(!b) return;
      utils.$('#statusFilters .btn').forEach(function(x){
        x.classList.remove('active');
      });
      b.classList.add('active');
      state.listFilter = b.dataset.filter;
      window.Render.buildList();
    });

    dom.listSort.addEventListener('change', function() {
      window.Render.buildList();
    });
  }

  function initStageClick() {
    dom.stageWrap.addEventListener('click', function(e) {
      if(e.target===dom.stageWrap || e.target===dom.linkLayer) {
        state.selectedId = (state.map && state.map.id) || null;
        window.Render.highlightSelection();
      }
    });
  }

  // Public API
  return {
    switchToMind: switchToMind,
    switchToList: switchToList,
    stageTransform: stageTransform,
    applyZoom: applyZoom,
    initWheelZoom: initWheelZoom,
    initPanning: initPanning,
    initDragAndDrop: initDragAndDrop,
    initButtonHandlers: initButtonHandlers,
    initNodeClickHandlers: initNodeClickHandlers,
    initKeyboardShortcuts: initKeyboardShortcuts,
    initSearch: initSearch,
    initViewToggles: initViewToggles,
    initStageClick: initStageClick
  };
})();
