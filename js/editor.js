// Editor Modal Functionality
window.Editor = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;

  function buildPalette(current) {
    dom.colorPalette.innerHTML = '';
    state.selectedPaletteColor = null;

    config.Palette.forEach(function(hex) {
      var b = document.createElement('button');
      b.className = 'swatchbtn';
      b.type = 'button';
      b.style.background = hex;
      b.setAttribute('aria-pressed', String(hex===current));
      if(hex===current) state.selectedPaletteColor = current;

      b.onclick = function() {
        state.selectedPaletteColor = hex;
        utils.$$('.swatchbtn', dom.colorPalette).forEach(function(x){
          x.setAttribute('aria-pressed','false');
        });
        b.setAttribute('aria-pressed','true');
      };

      dom.colorPalette.appendChild(b);
    });
  }

  function rebuildTemplateSelect(sel) {
    sel.innerHTML = '<option value="Client">Client</option><option value="COI">COI</option><option value="Account">Account</option><option value="Task">Task</option><option value="Opportunity">Opportunity</option><option value="Recurring Contact">Recurring Contact</option><option value="Note">Note</option><option value="Sub-Tree">Sub-Tree</option>';
  }

  function addKVRow(k, v) {
    if(k===undefined) k = '';
    if(v===undefined) v = '';

    var line = document.createElement('div');
    line.className = 'kv-line';
    line.innerHTML = '<input data-k placeholder="Field name" value="'+utils.esc(k)+'" /><input data-v placeholder="Value" value="'+utils.esc(v)+'" /><button class="btn" type="button" title="Remove">✕</button>';

    utils.$('button', line).onclick = function() {
      line.remove();
    };

    dom.kvArea.appendChild(line);
  }

  function openEditor(id) {
    var node = nodeOps.findNode(id).node;
    if(!node) return;

    dom.f_title.value = node.title || '';
    dom.f_due.value = node.due || '';
    dom.f_notes.value = node.notes || '';
    rebuildTemplateSelect(dom.f_template);
    dom.f_template.value = node.template || '';
    dom.f_freq.value = node.freq || '';

    // Set contact dates if they exist
    dom.f_lastcontact.value = utils.normalizeDate((node.fields && node.fields['Last Contact']) || '');
    dom.f_nextcontact.value = utils.normalizeDate((node.fields && node.fields['Next Contact']) || '');

    buildPalette(node.color);
    dom.kvArea.innerHTML = '';
    var entries = Object.entries(node.fields||{}).filter(function(entry){
      return ['Last Contact','Next Contact'].indexOf(entry[0])===-1;
    });
    if(entries.length===0) {
      addKVRow('','');
    } else {
      entries.forEach(function(pair){
        addKVRow(pair[0], String(pair[1]));
      });
    }

    function setStatusOptions(tmpl, current) {
      var taskOpts = ['todo','inprogress','blocked','done'];
      var tierOpts = ['A-tier','B-tier','C-tier','Dormant'];
      var opts = [];

      if(tmpl==='Task' || tmpl==='Recurring Contact') {
        opts = taskOpts;
      } else if(['Client','COI','Opportunity'].indexOf(tmpl)!==-1) {
        opts = tierOpts;
      } else {
        opts = [];
      }

      dom.f_status.innerHTML = opts.map(function(v){
        return '<option value="'+v+'">'+utils.labelStatus(v)+'</option>';
      }).join('');

      if(opts.length) {
        dom.f_status.disabled = false;
        dom.f_status.value = opts.indexOf(current)!==-1 ? current : opts[0];
      } else {
        dom.f_status.innerHTML = '';
        dom.f_status.disabled = true;
      }
    }

    function applyVisibility(tmpl) {
      var freqField = dom.f_freq.closest('.field');
      var dueField = dom.f_due.closest('.field');
      var lastContactField = dom.f_lastcontact.closest('.field');
      var nextContactField = dom.f_nextcontact.closest('.field');

      freqField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Recurring Contact') ? '' : 'none';
      dueField.style.display = (tmpl==='Task'||tmpl==='Recurring Contact') ? '' : 'none';
      lastContactField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Opportunity') ? '' : 'none';
      nextContactField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Opportunity') ? '' : 'none';
    }

    setStatusOptions(node.template, node.status||'');
    applyVisibility(node.template);

    dom.f_template.onchange = function() {
      setStatusOptions(dom.f_template.value, dom.f_status.value);
      applyVisibility(dom.f_template.value);
    };

    dom.editorBackdrop.style.display = 'flex';
    dom.editorBackdrop.setAttribute('aria-hidden','false');
    dom.importAccountsBtn.style.display = (node.template==='Account') ? 'inline-flex' : 'none';
    dom.importAccountsBtn.onclick = function() {
      alert('CSV import functionality - ready for implementation');
    };

    dom.saveEditBtn.onclick = function() {
      var prevTemplate = node.template;
      var prevStatus = node.status;

      node.title = dom.f_title.value.trim() || 'Untitled';
      node.due = dom.f_due.value;
      node.notes = dom.f_notes.value.trim();
      node.template = dom.f_template.value || prevTemplate;
      node.freq = dom.f_freq.value || '';

      if(!dom.f_status.disabled) {
        node.status = dom.f_status.value;
      }

      var freqField = dom.f_freq.closest('.field');
      if(freqField.style.display!=='none') {
        node.freq = dom.f_freq.value || '';
      } else {
        node.freq = '';
      }

      if(node.template !== prevTemplate) {
        var defaults = (config.Templates[node.template] && config.Templates[node.template].fields) || {};
        var merged = {};
        for(var k in defaults) {
          if(Object.prototype.hasOwnProperty.call(defaults,k)) merged[k] = defaults[k];
        }
        for(var k2 in node.fields) {
          if(Object.prototype.hasOwnProperty.call(node.fields,k2)) merged[k2] = node.fields[k2];
        }
        node.fields = merged;
        node.color = nodeOps.defaultColorForTemplate(node.template);
        nodeOps.ensureTags(node);
      }

      node.fields = {};
      utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
        var k = utils.$('input[data-k]', line).value.trim();
        var v = utils.$('input[data-v]', line).value.trim();
        if(k) node.fields[k] = v;
      });

      // Save contact dates if visible
      var lastContactField = dom.f_lastcontact.closest('.field');
      var nextContactField = dom.f_nextcontact.closest('.field');
      if(lastContactField.style.display !== 'none') {
        node.fields['Last Contact'] = dom.f_lastcontact.value || '';
      }
      if(nextContactField.style.display !== 'none') {
        node.fields['Next Contact'] = dom.f_nextcontact.value || '';
      }

      nodeOps.ensureTags(node);
      node.color = state.selectedPaletteColor || node.color;

      dom.editorBackdrop.style.display = 'none';
      dom.editorBackdrop.setAttribute('aria-hidden','true');

      if(prevStatus !== 'done' && node.status === 'done') {
        nodeOps.onStatusChange(node);
      }

      window.Storage.markDirty();
      window.Render.renderMindMap();
      window.Render.buildList();
    };

    dom.cancelEditBtn.onclick = function() {
      dom.editorBackdrop.style.display = 'none';
      dom.editorBackdrop.setAttribute('aria-hidden','true');
    };
  }

  // Initialize button handlers
  function init() {
    dom.addKVBtn.onclick = function() {
      return addKVRow();
    };
  }

  // Public API
  return {
    openEditor: openEditor,
    buildPalette: buildPalette,
    addKVRow: addKVRow,
    rebuildTemplateSelect: rebuildTemplateSelect,
    init: init
  };
})();
