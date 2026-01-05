// Configuration and Constants
window.AppConfig = {
  // RBC-themed color palette for nodes
  Palette: ['#003168','#005daa','#0073cc','#10b981','#f59e0b','#8b5cf6','#ef4444','#38bdf8','#60a5fa','#3b82f6','#34d399','#fbbf24','#a78bfa','#f87171','#93c5fd','#86efac'],

  // Template default colors (for node backgrounds)
  TemplateDefaultsColor: {
    'Client':'#003168',
    'COI':'#005daa',
    'Account':'#10b981',
    'Task':'#f59e0b',
    'Opportunity':'#8b5cf6',
    'Recurring Contact':'#f59e0b',
    'Note':'#38bdf8',
    'Sub-Tree':'#0073cc'
  },

  // Standardized template chip colors (different from node colors)
  TemplateChipColors: {
    'Client':'#003168',      // RBC Blue
    'COI':'#005daa',         // RBC Light Blue
    'Account':'#10b981',     // Green
    'Task':'#f59e0b',        // Orange
    'Opportunity':'#8b5cf6', // Purple
    'Recurring Contact':'#f97316', // Dark Orange
    'Note':'#06b6d4',        // Cyan
    'Sub-Tree':'#6366f1'     // Indigo
  },

  // Template definitions with fields and custom display functions
  Templates: {
    'Client': {
      fields: {
        'Client ID':'',
        'First Name':'',
        'Last Name':'',
        'Email':'',
        'Cell Number':'',
        'Lead Source':'',
        'Birthday':'',
        'Employer':'',
        'Phone':'',
        'Risk':'Moderate',
        'AUM':'',
        'Last Contact':'',
        'Next Contact':'',
        'Next Meeting':'',
        'Salesforce':'',
        'Tags':''
      }
    },
    'COI': {
      fields: {
        'First Name':'',
        'Last Name':'',
        'Email':'',
        'Cell Number':'',
        'Lead Source':'',
        'Birthday':'',
        'Employer':'',
        'Business Type':'',
        'Last Contact':'',
        'Next Contact':'',
        'Salesforce':'',
        'Notes':'',
        'Tags':''
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
      fields: {'Tags':''},
      show: function(n) {
        return '<strong>'+window.Utils.esc(n.title)+'</strong>'+(n.due?'<div>Due: '+window.Utils.formatDateDisplay(n.due)+'</div>':'');
      }
    },
    'Opportunity': {
      fields: {
        'Last Contact':'',
        'Next Contact':'',
        'Email':'',
        'First Name':'',
        'Last Name':'',
        'Cell Number':'',
        'Lead Source':'',
        'Birthday':'',
        'Employer':'',
        'Salesforce':'',
        'Tags':''
      }
    },
    'Recurring Contact': {
      fields: {'Frequency':'','Target':'Client/COI','Tags':''},
      show: function(n) {
        var freq = n.fields['Frequency']||n.freq||'';
        return '<strong>'+window.Utils.esc(n.title||'Recurring Contact')+'</strong>'+(n.due?('<div>Next: '+window.Utils.formatDateDisplay(n.due)+' ('+window.Utils.esc(freq)+')</div>'):'');
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
        return '<strong style="font-size:'+size+'px;display:block;line-height:1.1">'+window.Utils.esc(n.title)+'</strong>'+note;
      }
    }
  }
};
