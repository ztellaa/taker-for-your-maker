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

      var isClient = n.template==='Client';
      var isOpp = n.template==='Opportunity';
      var isCOI = n.template==='COI';

      var include = false;
      if(mode==='clientsOpps') {
        include = (isClient || isOpp);
      } else if(mode==='clientsCoi') {
        include = (isClient || isCOI);
      } else if(mode==='byTags') {
        include = tagSet.size===0 ? true : Array.from(tagSet).every(function(t){
          return tags.indexOf(t)!==-1;
        });
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

    // Search help modal
    dom.searchHelpBtn.onclick = function() {
      dom.searchHelpBackdrop.style.display = 'flex';
      dom.searchHelpBackdrop.setAttribute('aria-hidden','false');
    };

    dom.closeSearchHelpBtn.onclick = function() {
      dom.searchHelpBackdrop.style.display = 'none';
      dom.searchHelpBackdrop.setAttribute('aria-hidden','true');
    };
  }

  // Public API
  return {
    rebuildBackupsUI: rebuildBackupsUI,
    computeAudience: computeAudience,
    refreshMailingPreview: refreshMailingPreview,
    downloadCSV: downloadCSV,
    init: init
  };
})();
