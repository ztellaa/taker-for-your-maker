// Configuration and Constants
window.AppConfig = {
  // RBC-themed color palette for nodes
  Palette: ['#003168','#005daa','#0073cc','#10b981','#f59e0b','#8b5cf6','#ef4444','#38bdf8','#60a5fa','#3b82f6','#34d399','#fbbf24','#a78bfa','#f87171','#93c5fd','#86efac'],

  // Template default colors (for node backgrounds)
  TemplateDefaultsColor: {
    'Contact':'#003168',    // RBC Blue (unified from Client/COI/Opportunity)
    'Account':'#10b981',    // Green
    'Task':'#f59e0b',       // Orange
    'Note':'#38bdf8',       // Light Blue
    'Sub-Tree':'#0073cc'    // Dark Blue
  },

  // Standardized template chip colors (different from node colors)
  TemplateChipColors: {
    'Contact':'#003168',    // RBC Blue
    'Account':'#10b981',    // Green
    'Task':'#f59e0b',       // Orange
    'Note':'#06b6d4',       // Cyan
    'Sub-Tree':'#6366f1'    // Indigo
  },

  // Default directory hint for folder-backed persistence (see js/file-persistence.js)
  CrmFolderHint: 'C:\\Users\\591556352\\Local\\CRM\\actual_database',

  // Template definitions with fields and custom display functions
  Templates: {
    'Contact': {
      // Unified template combining Client, COI, and Opportunity fields
      fields: {
        'Client ID':'',
        'First Name':'',
        'Last Name':'',
        'Email':'',
        'Cell Number':'',
        'LinkedIn':'',
        'Lead Source':'',
        'Birthday':'',
        'Employer':'',
        'Phone':'',
        'Risk':'Moderate',
        'AUM':'',
        'Business Type':'',
        'Last Contact':'',
        'Next Contact':'',
        'Next Meeting':'',
        'Salesforce':'',
        'Tags':''
      },
      // Custom display - title from name, show only Email/LinkedIn/Cell
      show: function(n) {
        var firstName = (n.fields && n.fields['First Name']) || '';
        var lastName = (n.fields && n.fields['Last Name']) || '';
        var displayTitle = (firstName + ' ' + lastName).trim() || n.title || 'Contact';

        var contactInfo = [];
        var email = (n.fields && n.fields['Email']) || '';
        var cellNumber = (n.fields && n.fields['Cell Number']) || '';
        var linkedIn = (n.fields && n.fields['LinkedIn']) || '';

        // Email as mailto link (opens in new tab/window)
        if(email) {
          contactInfo.push('<a href="mailto:' + window.Utils.esc(email) + '" target="_blank" rel="noopener" style="color:#0073cc;text-decoration:none">📧 ' + window.Utils.esc(email) + '</a>');
        }
        if(cellNumber) contactInfo.push('<span>📞 ' + window.Utils.esc(cellNumber) + '</span>');
        if(linkedIn && /^https?:\/\//i.test(linkedIn)) {
          contactInfo.push('<a href="' + window.Utils.esc(linkedIn) + '" target="_blank" rel="noopener" style="color:#0073cc;text-decoration:none">💼 LinkedIn</a>');
        } else if(linkedIn) {
          contactInfo.push('<span>💼 ' + window.Utils.esc(linkedIn) + '</span>');
        }

        var contactHtml = contactInfo.length ?
          '<div style="margin-top:6px;font-size:13px;color:#d2d7e2;display:flex;flex-direction:column;gap:2px">' + contactInfo.join('') + '</div>' : '';

        return '<strong>' + window.Utils.esc(displayTitle) + '</strong>' + contactHtml;
      }
    },
    'Account': {
      fields: {
        'Account #':'',
        'Type':'RRSP',
        'Institution':'',
        'Holdings':'',
        'Cash':'',
        'Custodian':'',
        'Tags':''
      }
    },
    'Task': {
      fields: {'Tags':'', 'Channel':''},
      show: function(n) {
        return '<strong>'+window.Utils.esc(n.title)+'</strong>'+(n.due?'<div>Due: '+window.Utils.formatDateDisplay(n.due)+'</div>':'');
      }
    },
    'Note': {
      fields: {'Tags':''},
      show: function(n) {
        return '<strong>'+window.Utils.esc(n.title)+'</strong>'+(n.notes?('<div style="margin-top:6px;color:#d2d7e2">'+window.Utils.esc(n.notes)+'</div>'):'');
      }
    },
    'Sub-Tree': {
      fields: {'Tags':''},
      show: function(n, depth) {
        var size = Math.max(16, 28-depth*2);
        var note = n.notes?('<div style="margin-top:6px;color:#d2d7e2">'+window.Utils.esc(n.notes)+'</div>'):'';

        // Calculate and display Potential AUM
        var potentialAUM = window.NodeOps ? window.NodeOps.cumulativeAUM(n) : 0;
        var aumDisplay = '';
        if(potentialAUM > 0) {
          var formatted = '$' + potentialAUM.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
          aumDisplay = '<div style="margin-top:8px;padding:4px 8px;background:rgba(16,185,129,0.15);border:1px solid #10b981;border-radius:4px;color:#10b981;font-size:13px;font-weight:600">Potential AUM: ' + formatted + '</div>';
        }

        return '<strong style="font-size:'+size+'px;display:block;line-height:1.1">'+window.Utils.esc(n.title)+'</strong>'+note+aumDisplay;
      }
    }
  }
};
