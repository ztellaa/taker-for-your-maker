// Editor Modal Functionality
window.Editor = (function() {
  var utils = window.Utils;
  var config = window.AppConfig;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;

  // Validation state
  var validationErrors = {};
  var currentNodeTemplate = null;
  var originalLastContact = null;
  var originalFrameColor = null;
  var currentNodeId = null;

  // Show validation error for a field
  function showFieldError(kvLine, message) {
    var existing = kvLine.querySelector('.validation-error');
    if(existing) existing.remove();
    kvLine.classList.remove('has-error');

    if(message) {
      var errorDiv = document.createElement('div');
      errorDiv.className = 'validation-error';
      errorDiv.textContent = message;
      kvLine.appendChild(errorDiv);
      kvLine.classList.add('has-error');
    }
  }

  // Validate a single KV field
  function validateKVField(kvLine, template) {
    var keyInput = utils.$('input[data-k]', kvLine);
    var valueInput = utils.$('input[data-v]', kvLine);
    if(!keyInput || !valueInput) return;

    var fieldName = keyInput.value.trim();
    var fieldValue = valueInput.value.trim();

    if(!fieldName) {
      showFieldError(kvLine, null);
      delete validationErrors[fieldName];
      return;
    }

    var allFields = {};
    utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
      var k = utils.$('input[data-k]', line).value.trim();
      var v = utils.$('input[data-v]', line).value.trim();
      if(k) allFields[k] = v;
    });

    allFields['Last Contact'] = dom.f_lastcontact.value;
    allFields['Next Contact'] = dom.f_nextcontact.value;

    var result = window.Validation.validateField(template, fieldName, fieldValue, allFields);

    if(!result.valid) {
      showFieldError(kvLine, result.message);
      validationErrors[fieldName] = result.message;
    } else {
      showFieldError(kvLine, null);
      delete validationErrors[fieldName];
    }
  }

  // Track selected background color
  var selectedBgColor = null;

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

  function buildBgPalette(current) {
    dom.bgColorPalette.innerHTML = '';
    selectedBgColor = null;

    // Add "none" option first (transparent/default)
    var noneBtn = document.createElement('button');
    noneBtn.className = 'swatchbtn';
    noneBtn.type = 'button';
    noneBtn.style.background = 'linear-gradient(135deg, #fff 45%, #ccc 45%, #ccc 55%, #fff 55%)';
    noneBtn.title = 'Default (no background)';
    noneBtn.setAttribute('aria-pressed', String(!current));
    if(!current) selectedBgColor = null;

    noneBtn.onclick = function() {
      selectedBgColor = null;
      utils.$$('.swatchbtn', dom.bgColorPalette).forEach(function(x){
        x.setAttribute('aria-pressed','false');
      });
      noneBtn.setAttribute('aria-pressed','true');
    };
    dom.bgColorPalette.appendChild(noneBtn);

    config.Palette.forEach(function(hex) {
      var b = document.createElement('button');
      b.className = 'swatchbtn';
      b.type = 'button';
      b.style.background = hex;
      b.setAttribute('aria-pressed', String(hex===current));
      if(hex===current) selectedBgColor = current;

      b.onclick = function() {
        selectedBgColor = hex;
        utils.$$('.swatchbtn', dom.bgColorPalette).forEach(function(x){
          x.setAttribute('aria-pressed','false');
        });
        b.setAttribute('aria-pressed','true');
      };

      dom.bgColorPalette.appendChild(b);
    });
  }

  function rebuildTemplateSelect(sel) {
    sel.innerHTML = '<option value="Task">Task</option><option value="Note">Note</option><option value="Contact">Contact</option><option value="Account">Account</option><option value="Sub-Tree">Sub-Tree</option>';
  }

  function addKVRow(k, v) {
    if(k===undefined) k = '';
    if(v===undefined) v = '';

    var line = document.createElement('div');
    line.className = 'kv-line';
    line.innerHTML = '<input data-k placeholder="Field name" value="'+utils.esc(k)+'" /><input data-v placeholder="Value" value="'+utils.esc(v)+'" /><button class="btn" type="button" title="Remove">✕</button>';

    utils.$('button', line).onclick = function() {
      line.remove();
      var fieldName = utils.$('input[data-k]', line).value.trim();
      if(fieldName) delete validationErrors[fieldName];
    };

    var valueInput = utils.$('input[data-v]', line);
    valueInput.addEventListener('blur', function() {
      if(currentNodeTemplate) {
        validateKVField(line, currentNodeTemplate);
      }
    });

    dom.kvArea.appendChild(line);
  }

  function setStatusOptions(tmpl, current) {
    var taskOpts = ['todo','inprogress','blocked','done'];
    var tierOpts = ['A-tier','B-tier','C-tier','Dormant'];
    var opts = [];

    if(tmpl === 'Task') {
      opts = taskOpts;
    } else if(tmpl === 'Contact') {
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

  function applyVisibility(tmpl, node) {
    var freqField = dom.f_freq.closest('.field');
    var dueField = dom.f_due.closest('.field');
    var lastContactField = dom.f_lastcontact.closest('.field');
    var nextContactField = dom.f_nextcontact.closest('.field');
    var statusField = dom.f_status.closest('.field');
    var titleField = dom.f_title.closest('.field');

    var isContactTemplate = (tmpl === 'Contact');
    var isTaskTemplate = (tmpl === 'Task');

    // v13.0.6: Hide title field for Contact (auto-generated from First Name + Last Name)
    titleField.style.display = isContactTemplate ? 'none' : '';

    // Contact Frequency - only for Contact
    freqField.style.display = isContactTemplate ? '' : 'none';

    // Due date - for Task
    dueField.style.display = isTaskTemplate ? '' : 'none';

    statusField.style.display = '';

    // Last/Next Contact - for Contact
    lastContactField.style.display = isContactTemplate ? '' : 'none';
    nextContactField.style.display = isContactTemplate ? '' : 'none';

    // Channel (radio buttons) - for Task template
    if(dom.availableDetailsField) {
      dom.availableDetailsField.style.display = isTaskTemplate ? '' : 'none';

      // Set channel availability based on parent Contact
      if(isTaskTemplate && node) {
        var channels = nodeOps.getAvailableChannels(node);

        if(dom.touch_calls) {
          dom.touch_calls.disabled = !channels.call;
          dom.touch_calls.parentElement.style.opacity = channels.call ? '1' : '0.5';
        }
        if(dom.touch_linkedin) {
          dom.touch_linkedin.disabled = !channels.linkedin;
          dom.touch_linkedin.parentElement.style.opacity = channels.linkedin ? '1' : '0.5';
        }
        if(dom.touch_emails) {
          dom.touch_emails.disabled = !channels.email;
          dom.touch_emails.parentElement.style.opacity = channels.email ? '1' : '0.5';
        }
      }
    }
  }

  function openEditor(id) {
    var node = nodeOps.findNode(id).node;
    if(!node) return;

    // Reset validation state
    validationErrors = {};
    currentNodeTemplate = node.template;
    currentNodeId = id;

    // Track original Last Contact for touch detection
    originalLastContact = utils.normalizeDate((node.fields && node.fields['Last Contact']) || '');
    originalFrameColor = node.color;

    dom.f_title.value = node.title || '';
    dom.f_due.value = node.due || '';
    dom.f_notes.value = node.notes || '';
    rebuildTemplateSelect(dom.f_template);
    dom.f_template.value = node.template || '';
    dom.f_freq.value = node.freq || '';

    // Set contact dates if they exist
    dom.f_lastcontact.value = originalLastContact;
    dom.f_nextcontact.value = utils.normalizeDate((node.fields && node.fields['Next Contact']) || '');

    buildPalette(node.color);
    buildBgPalette(node.bgColor || null);
    dom.kvArea.innerHTML = '';
    var entries = Object.entries(node.fields||{}).filter(function(entry){
      // Filter out fields we handle separately
      return ['Last Contact','Next Contact','Channel'].indexOf(entry[0])===-1;
    });
    if(entries.length===0) {
      addKVRow('','');
    } else {
      entries.forEach(function(pair){
        addKVRow(pair[0], String(pair[1]));
      });
    }

    setStatusOptions(node.template, node.status||'');
    applyVisibility(node.template, node);

    // Restore Channel radio selection for Task
    var savedChannel = (node.fields && node.fields['Channel']) || '';
    if(dom.touch_calls) dom.touch_calls.checked = (savedChannel === 'calls');
    if(dom.touch_linkedin) dom.touch_linkedin.checked = (savedChannel === 'linkedin');
    if(dom.touch_emails) dom.touch_emails.checked = (savedChannel === 'emails');

    // Auto-calculate Next Contact when Last Contact changes
    dom.f_lastcontact.onchange = function() {
      if (this.value) {
        var lastContact = new Date(this.value);
        var offsetDays = parseInt(dom.defaultOffsetInput.value) || 7;
        var nextContact = new Date(lastContact);
        nextContact.setDate(nextContact.getDate() + offsetDays);

        var year = nextContact.getFullYear();
        var month = String(nextContact.getMonth() + 1).padStart(2, '0');
        var day = String(nextContact.getDate()).padStart(2, '0');
        dom.f_nextcontact.value = year + '-' + month + '-' + day;
      }
    };

    dom.f_template.onchange = function() {
      currentNodeTemplate = dom.f_template.value;
      setStatusOptions(dom.f_template.value, dom.f_status.value);
      applyVisibility(dom.f_template.value, node);
      validationErrors = {};
      utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
        showFieldError(line, null);
      });
    };

    dom.editorBackdrop.style.display = 'flex';
    dom.editorBackdrop.setAttribute('aria-hidden','false');
    dom.importAccountsBtn.style.display = (node.template==='Account') ? 'inline-flex' : 'none';
    dom.importAccountsBtn.onclick = function() {
      alert('CSV import functionality - ready for implementation');
    };

    dom.saveEditBtn.onclick = function() {
      window.UndoManager.capture('edit', {nodeId: node.id, title: node.title});

      var tempNode = {
        template: dom.f_template.value || node.template,
        fields: {}
      };

      utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
        var k = utils.$('input[data-k]', line).value.trim();
        var v = utils.$('input[data-v]', line).value.trim();
        if(k) tempNode.fields[k] = v;
      });

      var lastContactField = dom.f_lastcontact.closest('.field');
      var nextContactField = dom.f_nextcontact.closest('.field');
      if(lastContactField.style.display !== 'none') {
        tempNode.fields['Last Contact'] = dom.f_lastcontact.value || '';
      }
      if(nextContactField.style.display !== 'none') {
        tempNode.fields['Next Contact'] = dom.f_nextcontact.value || '';
      }

      var validationResult = window.Validation.validateNode(tempNode);
      if(!validationResult.valid) {
        utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
          var fieldName = utils.$('input[data-k]', line).value.trim();
          if(fieldName && validationResult.errors[fieldName]) {
            showFieldError(line, validationResult.errors[fieldName]);
          }
        });
        alert('Please fix validation errors before saving.');
        return;
      }

      var prevTemplate = node.template;

      // v13.0.6: For Contact, auto-generate title from First Name + Last Name
      if(dom.f_template.value === 'Contact' || node.template === 'Contact') {
        // Get names from KV fields
        var firstName = '', lastName = '';
        utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
          var k = utils.$('input[data-k]', line).value.trim();
          var v = utils.$('input[data-v]', line).value.trim();
          if(k === 'First Name') firstName = v;
          if(k === 'Last Name') lastName = v;
        });
        var generatedTitle = (firstName + ' ' + lastName).trim();
        node.title = generatedTitle || 'Contact';
      } else {
        node.title = dom.f_title.value.trim() || 'Untitled';
      }
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
      if(lastContactField.style.display !== 'none') {
        node.fields['Last Contact'] = dom.f_lastcontact.value || '';
      }
      if(nextContactField.style.display !== 'none') {
        node.fields['Next Contact'] = dom.f_nextcontact.value || '';
      }

      // Save Channel for Task template
      if(dom.availableDetailsField && dom.availableDetailsField.style.display !== 'none') {
        var checkedChannel = document.querySelector('input[name="taskTouchType"]:checked');
        node.fields['Channel'] = checkedChannel ? checkedChannel.value : '';
      }

      nodeOps.ensureTags(node);
      if(node.template === 'Contact' && state.selectedPaletteColor && state.selectedPaletteColor !== originalFrameColor) {
        node.colorIsCustom = true;
      }
      node.color = state.selectedPaletteColor || node.color;
      node.bgColor = selectedBgColor || null;

      dom.editorBackdrop.style.display = 'none';
      dom.editorBackdrop.setAttribute('aria-hidden','true');

      // Handle Task completion side effects (Last Contact stamp, Analytics)
      if(node.template === 'Task') {
        nodeOps.applyTaskCompletion(node);
      }

      // Handle Note roll-up
      if(node.template === 'Note') {
        nodeOps.rollUpNote(node);
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

  function init() {
    dom.addKVBtn.onclick = function() {
      return addKVRow();
    };
  }

  return {
    openEditor: openEditor,
    buildPalette: buildPalette,
    addKVRow: addKVRow,
    rebuildTemplateSelect: rebuildTemplateSelect,
    init: init
  };
})();
