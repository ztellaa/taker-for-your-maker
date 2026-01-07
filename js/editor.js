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

  // Show validation error for a field
  function showFieldError(kvLine, message) {
    // Remove existing error if any
    var existing = kvLine.querySelector('.validation-error');
    if(existing) existing.remove();

    // Remove has-error class
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

    // Get all current fields for dateRange validation
    var allFields = {};
    utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
      var k = utils.$('input[data-k]', line).value.trim();
      var v = utils.$('input[data-v]', line).value.trim();
      if(k) allFields[k] = v;
    });

    // Add special fields
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
      // Clear validation error for removed field
      var fieldName = utils.$('input[data-k]', line).value.trim();
      if(fieldName) delete validationErrors[fieldName];
    };

    // Add blur validation to value input
    var valueInput = utils.$('input[data-v]', line);
    valueInput.addEventListener('blur', function() {
      if(currentNodeTemplate) {
        validateKVField(line, currentNodeTemplate);
      }
    });

    dom.kvArea.appendChild(line);
  }

  function openEditor(id) {
    var node = nodeOps.findNode(id).node;
    if(!node) return;

    // Reset validation state
    validationErrors = {};
    currentNodeTemplate = node.template;

    // Track original Last Contact for touch detection
    originalLastContact = utils.normalizeDate((node.fields && node.fields['Last Contact']) || '');

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
      var touchField = utils.$('#touchField');

      var isContactTemplate = (tmpl==='Client'||tmpl==='COI'||tmpl==='Opportunity');
      var isTaskTemplate = (tmpl==='Task');

      freqField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Recurring Contact') ? '' : 'none';
      dueField.style.display = (tmpl==='Task'||tmpl==='Recurring Contact') ? '' : 'none';
      lastContactField.style.display = isContactTemplate ? '' : 'none';
      nextContactField.style.display = isContactTemplate ? '' : 'none';
      touchField.style.display = isTaskTemplate ? '' : 'none';
    }

    setStatusOptions(node.template, node.status||'');
    applyVisibility(node.template);

    // Make touch checkboxes mutually exclusive
    var touchCheckboxes = [
      utils.$('#touch_calls'),
      utils.$('#touch_linkedin'),
      utils.$('#touch_emails')
    ];

    touchCheckboxes.forEach(function(checkbox) {
      if (checkbox) {
        checkbox.checked = false; // Reset on open
        checkbox.addEventListener('change', function() {
          if (this.checked) {
            touchCheckboxes.forEach(function(other) {
              if (other !== checkbox) other.checked = false;
            });
          }
        });
      }
    });

    // Auto-calculate Next Contact when Last Contact changes
    dom.f_lastcontact.addEventListener('change', function() {
      if (this.value) {
        var lastContact = new Date(this.value);
        var offsetDays = parseInt(dom.defaultOffsetInput.value) || 7;
        var nextContact = new Date(lastContact);
        nextContact.setDate(nextContact.getDate() + offsetDays);

        // Format as YYYY-MM-DD
        var year = nextContact.getFullYear();
        var month = String(nextContact.getMonth() + 1).padStart(2, '0');
        var day = String(nextContact.getDate()).padStart(2, '0');
        dom.f_nextcontact.value = year + '-' + month + '-' + day;
      }
    });

    dom.f_template.onchange = function() {
      currentNodeTemplate = dom.f_template.value;
      setStatusOptions(dom.f_template.value, dom.f_status.value);
      applyVisibility(dom.f_template.value);
      // Clear validation errors when template changes
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
      // Capture state before editing
      window.UndoManager.capture('edit', {nodeId: node.id, title: node.title});

      // Build temporary node data for validation
      var tempNode = {
        template: dom.f_template.value || node.template,
        fields: {}
      };

      // Collect all KV fields
      utils.$$('.kv-line', dom.kvArea).forEach(function(line) {
        var k = utils.$('input[data-k]', line).value.trim();
        var v = utils.$('input[data-v]', line).value.trim();
        if(k) tempNode.fields[k] = v;
      });

      // Add contact dates if visible
      var lastContactField = dom.f_lastcontact.closest('.field');
      var nextContactField = dom.f_nextcontact.closest('.field');
      if(lastContactField.style.display !== 'none') {
        tempNode.fields['Last Contact'] = dom.f_lastcontact.value || '';
      }
      if(nextContactField.style.display !== 'none') {
        tempNode.fields['Next Contact'] = dom.f_nextcontact.value || '';
      }

      // Validate the node
      var validationResult = window.Validation.validateNode(tempNode);
      if(!validationResult.valid) {
        // Show errors inline
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

      // NEW TOUCH WORKFLOW (v13.0.3)

      // 1. For Opportunity/COI: If Last Contact changed, update associated Task
      var newLastContact = dom.f_lastcontact.value || '';
      var newNextContact = dom.f_nextcontact.value || '';
      var isOppOrCOI = (node.template === 'Opportunity' || node.template === 'COI');
      var lastContactChanged = newLastContact && newLastContact !== originalLastContact;

      if (isOppOrCOI && lastContactChanged) {
        // Find or create Task under this Opportunity/COI
        var task = nodeOps.findOrCreateTask(node);
        if (task) {
          if (!task.fields) task.fields = {};
          task.fields['Last Contact'] = newLastContact;
          if (newNextContact) {
            task.fields['Next Contact'] = newNextContact;
          }
        }
      }

      // 2. For Task: If touch checkbox selected, create Touch node
      var isTask = (node.template === 'Task');
      if (isTask) {
        var touchCalls = utils.$('#touch_calls');
        var touchLinkedIn = utils.$('#touch_linkedin');
        var touchEmails = utils.$('#touch_emails');
        var touchSuccessful = utils.$('#touch_successful');

        var selectedChannel = null;
        if (touchCalls && touchCalls.checked) selectedChannel = 'calls';
        else if (touchLinkedIn && touchLinkedIn.checked) selectedChannel = 'linkedin';
        else if (touchEmails && touchEmails.checked) selectedChannel = 'emails';

        if (selectedChannel) {
          // Create Touch node as child of this Task
          var touchNode = nodeOps.newNode('Touch ' + utils.today(), 'Note', node);
          touchNode.color = '#4CAF50'; // Green for touch
          if (!touchNode.fields) touchNode.fields = {};
          touchNode.fields['Touch Type'] = selectedChannel;
          touchNode.fields['Date'] = utils.today();
          touchNode.fields['Successful'] = (touchSuccessful && touchSuccessful.checked) ? 'Yes' : 'No';
          node.children.push(touchNode);

          // Record analytics
          var result = window.Analytics.recordTouch(selectedChannel);
          if (result.success) {
            window.TouchTracker.showToast('Touch recorded: ' + selectedChannel + ' (' + result.count + '/20 today)');
          }

          // Handle successful vs unsuccessful touch
          var wasSuccessful = (touchSuccessful && touchSuccessful.checked);
          if (wasSuccessful) {
            // Mark Task as completed
            node.status = 'done';

            // Propagate to parent Opportunity/COI and create new Task
            var parentInfo = nodeOps.findNode(node.id);
            if (parentInfo && parentInfo.parent) {
              var parent = parentInfo.parent;
              if (parent.template === 'Opportunity' || parent.template === 'COI') {
                // Update parent's contact dates
                if (!parent.fields) parent.fields = {};
                parent.fields['Last Contact'] = utils.today();

                // Calculate Next Contact using activity offset
                var offsetDays = parseInt(dom.defaultOffsetInput.value) || 7;
                var nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + offsetDays);
                var nextContactStr = nextDate.toISOString().slice(0,10);
                parent.fields['Next Contact'] = nextContactStr;

                // Create new Task under parent
                var newTask = nodeOps.newNode('Follow-up', 'Task', parent);
                newTask.due = nextContactStr;
                newTask.status = 'todo';
                parent.children.push(newTask);
              }
            }
          } else {
            // Unsuccessful touch: set Task due to tomorrow
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            node.due = tomorrow.toISOString().slice(0,10);
          }

          // Select the Touch node
          state.selectedId = touchNode.id;
        }
      }

      // 3. Propagate Task changes to parent Opportunity/COI
      if (isTask) {
        var parentInfo = nodeOps.findNode(node.id);
        if (parentInfo && parentInfo.parent) {
          var parent = parentInfo.parent;
          if (parent.template === 'Opportunity' || parent.template === 'COI') {
            if (!parent.fields) parent.fields = {};
            if (node.fields && node.fields['Last Contact']) {
              parent.fields['Last Contact'] = node.fields['Last Contact'];
            }
            if (node.fields && node.fields['Next Contact']) {
              parent.fields['Next Contact'] = node.fields['Next Contact'];
            }
          }
        }
      }
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
