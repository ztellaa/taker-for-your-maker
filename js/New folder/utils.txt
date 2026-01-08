// Utility Functions
window.Utils = {
  // DOM helpers
  $: function(sel, el) {
    return (el||document).querySelector(sel);
  },

  $$: function(sel, el) {
    return Array.from((el||document).querySelectorAll(sel));
  },

  // Generate unique ID
  uuid: function() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  },

  // Clamp value between min and max
  clamp: function(v, a, b) {
    return Math.max(a, Math.min(b, v));
  },

  // Escape HTML
  esc: function(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  },

  // Shade color lighter or darker
  shade: function(hex, amt) {
    try {
      var c = hex.replace('#','');
      var num = parseInt(c,16);
      var r = (num>>16)&255, g = (num>>8)&255, b = num&255;
      r = Math.round(Math.max(0, Math.min(1, r/255+amt))*255);
      g = Math.round(Math.max(0, Math.min(1, g/255+amt))*255);
      b = Math.round(Math.max(0, Math.min(1, b/255+amt))*255);
      return '#'+(((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1));
    } catch(e) {
      return hex;
    }
  },

  // Label status for display
  labelStatus: function(s) {
    return ({
      todo:'To do',
      inprogress:'In progress',
      blocked:'Blocked',
      done:'Done',
      'A-tier':'A-tier',
      'B-tier':'B-tier',
      'C-tier':'C-tier',
      'Dormant':'Dormant'
    })[s] || s;
  },

  // Format currency
  formatCurrency: function(num) {
    var n = parseFloat(num)||0;
    return new Intl.NumberFormat('en-CA', {style:'currency', currency:'CAD'}).format(n);
  },

  // Date format utilities for DD/MM/YY display
  formatDateDisplay: function(isoDate) {
    if(!isoDate) return '';
    try {
      var parts = isoDate.split('-');
      if(parts.length !== 3) return isoDate;
      var year = parts[0].slice(-2); // Last 2 digits of year
      var month = parts[1];
      var day = parts[2];
      return day + '/' + month + '/' + year;
    } catch(e) {
      return isoDate;
    }
  },

  // Parse Canadian date format DD/MM/YY to ISO
  parseCanadianDate: function(ddmmyy) {
    if(!ddmmyy) return '';
    try {
      var parts = ddmmyy.split('/');
      if(parts.length !== 3) return ddmmyy;
      var day = parts[0].padStart(2,'0');
      var month = parts[1].padStart(2,'0');
      var year = parts[2];
      // Convert 2-digit year to 4-digit
      if(year.length === 2) {
        var currentYear = new Date().getFullYear();
        var century = Math.floor(currentYear/100)*100;
        var fullYear = century + parseInt(year);
        // If date is more than 50 years in future, assume previous century
        if(fullYear > currentYear + 50) fullYear -= 100;
        year = fullYear.toString();
      }
      return year + '-' + month + '-' + day;
    } catch(e) {
      return '';
    }
  },

  // Normalize date to ISO format
  normalizeDate: function(s) {
    if(!s) return '';
    if(s.indexOf('/')!==-1) {
      var parts = s.split('/');
      if(parts.length===3) {
        var d = parts[0].padStart(2,'0');
        var m = parts[1].padStart(2,'0');
        var y = parts[2];
        if(y.length===2) {
          y = (parseInt(y,10)>=70 ? '19' : '20') + y;
        }
        return y+'-'+m+'-'+d;
      }
    }
    return s;
  },

  // Get today's date in ISO format
  today: function() {
    return new Date().toISOString().slice(0,10);
  },

  // Advance date by number of days
  advanceDate: function(ymd, days) {
    try {
      var d = new Date(ymd+'T00:00:00');
      d.setDate(d.getDate()+days);
      return d.toISOString().slice(0,10);
    } catch(e) {
      return ymd;
    }
  },

  // Sanitize filename
  sanitize: function(s) {
    return String(s).replace(/[^a-z0-9\- _]/gi,'_');
  },

  // CSV escape
  csvEsc: function(s) {
    var v = (s||'').replace(/"/g,'""');
    return /[",\n]/.test(v) ? '"'+v+'"' : v;
  },

  // Convert frequency to days
  freqToDays: function(freq) {
    return ({monthly:30, quarterly:90, biannually:182, annually:365}[freq]||90);
  }
};
