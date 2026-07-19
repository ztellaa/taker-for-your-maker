// Backups and Mailing Modal Functionality
window.Modals = (function() {
  var utils = window.Utils;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;
  var storage = window.Storage;

  // Backups Modal
  function rebuildBackupsUI() {
    dom.backupsList.innerHTML = '';
    var list = storage.readBackups();

    if(!list.length) {
      dom.backupsList.innerHTML = '<div class="row"><div>No backups yet.</div></div>';
      return;
    }

    list.forEach(function(b) {
      var row = document.createElement('div');
      row.className = 'row';
      var dt = new Date(b.ts).toLocaleString();
      row.innerHTML = '<div><div class=title>'+utils.esc(b.name)+'</div><div class=crumbs>'+utils.esc(dt)+' · '+utils.esc(b.reason||'autosave')+'</div></div><div class=right><button class=btn data-act=restore>Restore</button><button class=btn data-act=download>Download</button></div>';

      row.addEventListener('click', function(e) {
        var act = e.target && e.target.dataset && e.target.dataset.act;

        if(act==='restore') {
          if(confirm('Restore this backup? Current map will be replaced.')) {
            storage.applyLoaded(b.payload);
            dom.backupsBackdrop.style.display = 'none';
          }
        }

        if(act==='download') {
          var blob = new Blob([JSON.stringify(b.payload,null,2)], {type:'application/json'});
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = b.name;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      });

      dom.backupsList.appendChild(row);
    });
  }

  // Mailing Modal
  function computeAudience() {
    var mode = dom.audienceSel.value;
    var tagSet = new Set((dom.tagsFilter.value||'').split(',').map(function(s){
      return s.trim().toLowerCase();
    }).filter(Boolean));

    var out = [];
    var seen = new Set();

    nodeOps.bfs(state.map, function(n) {
      var email = (n.fields['Email']||'').trim();
      if(!email) return;

      var first = (n.fields['First Name'] || n.title.split(' ')[0] || '').trim();
      var last = (n.fields['Last Name'] || '').trim();
      var company = (n.fields['Employer'] || '').trim();
      var tags = (n.fields['Tags'] || '').toLowerCase();

      var isContact = n.template==='Contact';

      var include = false;
      if(mode==='allContacts') {
        include = isContact;
      } else if(mode==='byTags') {
        include = isContact && (tagSet.size===0 ? true : Array.from(tagSet).every(function(t){
          return tags.indexOf(t)!==-1;
        }));
      } else if(mode==='byTier') {
        // Filter by status tier (A-tier, B-tier, C-tier, Dormant)
        var tier = dom.tagsFilter.value.trim().toLowerCase();
        include = isContact && (!tier || (n.status || '').toLowerCase().indexOf(tier) !== -1);
      }

      if(include) {
        if(!seen.has(email)) {
          out.push({
            first: first,
            last: last,
            email: email,
            company: company,
            type: n.template
          });
          seen.add(email);
        }
      }
    });

    return out;
  }

  function refreshMailingPreview() {
    var rows = computeAudience().slice(0,50);
    dom.mailingPreview.innerHTML = '';

    rows.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<div class=title>'+utils.esc(r.first+' '+r.last)+'</div><div class=crumbs>'+utils.esc(r.email)+' • '+utils.esc(r.type)+'</div>';
      dom.mailingPreview.appendChild(row);
    });
  }

  function downloadCSV() {
    var rows = computeAudience();
    var lines = ['first name,last name,email,company,type'];

    rows.forEach(function(r) {
      lines.push(
        utils.csvEsc(r.first)+','+
        utils.csvEsc(r.last)+','+
        utils.csvEsc(r.email)+','+
        utils.csvEsc(r.company)+','+
        utils.csvEsc(r.type)
      );
    });

    var blob = new Blob([lines.join('\n')], {type:'text/csv'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mailing-'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Import Modal
  var lastImportRows = [];

  // Recognize CSV header columns (case-insensitive) and return their indices
  function mapImportHeaders(headerRow) {
    var map = {name: -1, first: -1, last: -1, email: -1, phone: -1, notes: -1};
    headerRow.forEach(function(h, i) {
      var key = (h || '').trim().toLowerCase();
      if(key === 'name') map.name = i;
      else if(key === 'first name' || key === 'first') map.first = i;
      else if(key === 'last name' || key === 'last') map.last = i;
      else if(key === 'email') map.email = i;
      else if(key === 'phone' || key === 'cell' || key === 'cell number' || key === 'phone number') map.phone = i;
      else if(key === 'notes' || key === 'note') map.notes = i;
    });
    return map;
  }

  function parseImportRows(csvText) {
    var rows = utils.parseCSV(csvText);
    if(rows.length < 2) return [];

    var headerMap = mapImportHeaders(rows[0]);
    var out = [];

    for(var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var firstName = '', lastName = '';

      if(headerMap.name !== -1) {
        var full = (r[headerMap.name] || '').trim();
        var sp = full.indexOf(' ');
        if(sp === -1) {
          firstName = full;
        } else {
          firstName = full.slice(0, sp);
          lastName = full.slice(sp + 1).trim();
        }
      } else {
        firstName = (headerMap.first !== -1 ? r[headerMap.first] : '') || '';
        lastName = (headerMap.last !== -1 ? r[headerMap.last] : '') || '';
      }

      var email = ((headerMap.email !== -1 ? r[headerMap.email] : '') || '').trim();
      var phone = ((headerMap.phone !== -1 ? r[headerMap.phone] : '') || '').trim();
      var notes = ((headerMap.notes !== -1 ? r[headerMap.notes] : '') || '').trim();
      firstName = firstName.trim();
      lastName = lastName.trim();

      if(!firstName && !lastName && !email) continue; // skip fully-empty rows

      out.push({firstName: firstName, lastName: lastName, email: email, phone: phone, notes: notes});
    }

    return out;
  }

  function renderImportPreview(rows) {
    lastImportRows = rows;
    dom.importPreviewList.innerHTML = '';

    if(!rows.length) {
      dom.importPreviewList.innerHTML = '<div class="row"><div>No rows to import. Check your CSV has a header row and recognized columns.</div></div>';
      dom.confirmImportBtn.disabled = true;
      return;
    }

    rows.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'row';
      var name = (r.firstName + ' ' + r.lastName).trim() || '(no name)';
      var crumbs = [r.email, r.phone, r.notes ? r.notes.slice(0, 40) : ''].filter(Boolean).join(' · ');
      row.innerHTML = '<div><div class=title>' + utils.esc(name) + '</div><div class=crumbs>' + utils.esc(crumbs) + '</div></div>';
      dom.importPreviewList.appendChild(row);
    });

    dom.confirmImportBtn.disabled = false;
  }

  function runImport() {
    if(!lastImportRows.length) return;

    var parent = (state.selectedId && nodeOps.findNode(state.selectedId).node) || state.map;

    var importGroup = nodeOps.newNode('CSV Import ' + utils.formatDateDisplay(utils.today()), 'Sub-Tree', parent);
    parent.children.push(importGroup);

    lastImportRows.forEach(function(r) {
      var title = (r.firstName + ' ' + r.lastName).trim() || r.email || 'New Contact';
      var contact = nodeOps.newNode(title, 'Contact', importGroup);
      contact.fields['First Name'] = r.firstName;
      contact.fields['Last Name'] = r.lastName;
      contact.fields['Email'] = r.email;
      contact.fields['Cell Number'] = r.phone;
      contact.notes = r.notes;
      importGroup.children.push(contact);
    });

    var count = lastImportRows.length;
    lastImportRows = [];
    dom.confirmImportBtn.disabled = true;

    window.Storage.markDirty();
    window.Render.renderMindMap();
    window.Render.buildList();

    dom.importBackdrop.style.display = 'none';
    dom.importBackdrop.setAttribute('aria-hidden', 'true');

    alert('Imported ' + count + ' contact' + (count === 1 ? '' : 's') + '.');
  }

  // Initialize modal handlers
  function init() {
    // Backups modal
    dom.backupsBtn.onclick = function() {
      rebuildBackupsUI();
      dom.backupsBackdrop.style.display = 'flex';
      dom.backupsBackdrop.setAttribute('aria-hidden','false');
    };

    dom.closeBackupsBtn.onclick = function() {
      dom.backupsBackdrop.style.display = 'none';
      dom.backupsBackdrop.setAttribute('aria-hidden','true');
    };

    if(dom.restoreFromFolderBtn) {
      dom.restoreFromFolderBtn.onclick = function() {
        if(!window.FilePersistence) return;
        window.FilePersistence.readSnapshot().then(function(data) {
          if(!data || !data.map) {
            alert('No save file found in the connected CRM folder.');
            return;
          }
          if(confirm('Restore from the CRM folder? Current map will be replaced.')) {
            storage.applyLoaded(data);
            dom.backupsBackdrop.style.display = 'none';
            dom.backupsBackdrop.setAttribute('aria-hidden','true');
          }
        });
      };
    }

    // Mailing modal
    dom.mailingBtn.onclick = function() {
      refreshMailingPreview();
      dom.mailingBackdrop.style.display = 'flex';
      dom.mailingBackdrop.setAttribute('aria-hidden','false');
    };

    dom.closeMailingBtn.onclick = function() {
      dom.mailingBackdrop.style.display = 'none';
      dom.mailingBackdrop.setAttribute('aria-hidden','true');
    };

    dom.refreshPreviewBtn.onclick = function() {
      return refreshMailingPreview();
    };

    dom.downloadCSVBtn.onclick = function() {
      return downloadCSV();
    };

    // Import modal
    dom.importBtn.onclick = function() {
      dom.importPreviewList.innerHTML = '';
      dom.confirmImportBtn.disabled = true;
      dom.importBackdrop.style.display = 'flex';
      dom.importBackdrop.setAttribute('aria-hidden', 'false');
    };

    dom.closeImportBtn.onclick = function() {
      dom.importBackdrop.style.display = 'none';
      dom.importBackdrop.setAttribute('aria-hidden', 'true');
    };

    dom.copyImportTemplateBtn.onclick = function() {
      var text = dom.importTemplateBox.value;
      if(navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function() {
          dom.importTemplateBox.select();
          document.execCommand('copy');
        });
      } else {
        dom.importTemplateBox.select();
        document.execCommand('copy');
      }
    };

    dom.loadImportFileBtn.onclick = function() {
      dom.importFileInput.click();
    };

    dom.importFileInput.onchange = function() {
      var file = dom.importFileInput.files && dom.importFileInput.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        dom.importCsvText.value = e.target.result;
      };
      reader.readAsText(file);
      dom.importFileInput.value = '';
    };

    dom.previewImportBtn.onclick = function() {
      renderImportPreview(parseImportRows(dom.importCsvText.value));
    };

    dom.confirmImportBtn.onclick = function() {
      runImport();
    };

    // Search help modal
    dom.searchHelpBtn.onclick = function() {
      dom.searchHelpBackdrop.style.display = 'flex';
      dom.searchHelpBackdrop.setAttribute('aria-hidden','false');
    };

    dom.closeSearchHelpBtn.onclick = function() {
      dom.searchHelpBackdrop.style.display = 'none';
      dom.searchHelpBackdrop.setAttribute('aria-hidden','true');
    };

    // Shortcuts modal
    dom.shortcutsBtn.onclick = function() {
      dom.shortcutsBackdrop.style.display = 'flex';
      dom.shortcutsBackdrop.setAttribute('aria-hidden','false');
    };

    dom.closeShortcutsBtn.onclick = function() {
      dom.shortcutsBackdrop.style.display = 'none';
      dom.shortcutsBackdrop.setAttribute('aria-hidden','true');
    };

  }

  // Public API
  return {
    rebuildBackupsUI: rebuildBackupsUI,
    computeAudience: computeAudience,
    refreshMailingPreview: refreshMailingPreview,
    downloadCSV: downloadCSV,
    parseImportRows: parseImportRows,
    runImport: runImport,
    init: init
  };
})();
