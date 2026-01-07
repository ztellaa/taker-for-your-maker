// Analytics Integration - Weekly Business Development Tracking
window.Analytics = (function() {
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Get Monday of current week
  function getMondayOfWeek(date) {
    var d = new Date(date || new Date());
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Format date as YYYY-MM-DD
  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // Get week key for a date
  function getWeekKey(date) {
    var monday = getMondayOfWeek(date);
    return 'bd_week_' + formatDate(monday);
  }

  // Get current week key
  function getCurrentWeekKey() {
    return getWeekKey(new Date());
  }

  // Create empty day structure
  function emptyDay() {
    return {
      calls: Array(20).fill(false),
      linkedin: Array(20).fill(false),
      emails: Array(20).fill(false)
    };
  }

  // Create empty week structure
  function makeEmptyWeek(date) {
    return {
      meta: { weekStart: getMondayOfWeek(date).toISOString() },
      days: [emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay()],
      meetings: { booked: 0, goal: 10 },
      notes: '',
      minis: {},
      focus: []
    };
  }

  // Get week data from localStorage
  function getWeekData(weekKey) {
    try {
      var data = localStorage.getItem(weekKey);
      if (!data) return null;
      var parsed = JSON.parse(data);

      // Ensure focus array exists (migration)
      if (!parsed.focus) parsed.focus = [];

      return parsed;
    } catch (e) {
      return null;
    }
  }

  // Save week data to localStorage
  function saveWeekData(weekKey, data) {
    try {
      localStorage.setItem(weekKey, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Get day index (0 = Monday, 4 = Friday)
  function getDayIndex(date) {
    var d = date || new Date();
    var day = d.getDay();
    // Convert Sunday (0) to 6, then shift to 0=Monday
    return Math.min(4, (day + 6) % 7);
  }

  // Record a touch for today
  function recordTouch(channel) {
    if (['calls', 'linkedin', 'emails'].indexOf(channel) === -1) {
      return { success: false, error: 'Invalid channel' };
    }

    var weekKey = getCurrentWeekKey();
    var data = getWeekData(weekKey) || makeEmptyWeek(new Date());
    var dayIdx = getDayIndex();

    // Find first unchecked box for today
    var boxes = data.days[dayIdx][channel];
    var nextIdx = boxes.indexOf(false);

    if (nextIdx === -1) {
      return {
        success: false,
        error: 'All 20 boxes already checked for ' + channel + ' today',
        count: 20,
        total: 20
      };
    }

    // Mark the box as checked
    data.days[dayIdx][channel][nextIdx] = true;
    saveWeekData(weekKey, data);

    // Count total for today
    var todayCount = boxes.filter(Boolean).length + 1; // +1 because we just added one

    return {
      success: true,
      channel: channel,
      count: todayCount,
      total: 20,
      dayIndex: dayIdx
    };
  }

  // Get current week totals
  function getCurrentWeekTotals() {
    var weekKey = getCurrentWeekKey();
    var data = getWeekData(weekKey);

    if (!data) {
      return {
        calls: { today: 0, week: 0 },
        linkedin: { today: 0, week: 0 },
        emails: { today: 0, week: 0 }
      };
    }

    var dayIdx = getDayIndex();
    var result = {};

    ['calls', 'linkedin', 'emails'].forEach(function(channel) {
      var todayCount = data.days[dayIdx][channel].filter(Boolean).length;
      var weekCount = 0;

      data.days.forEach(function(day) {
        weekCount += day[channel].filter(Boolean).length;
      });

      result[channel] = {
        today: todayCount,
        week: weekCount
      };
    });

    return result;
  }

  // Get all-time averages
  function getAllTimeAverages() {
    var agg = { calls: 0, linkedin: 0, emails: 0 };
    var weeks = 0;

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);

      if (key && key.indexOf('bd_week_') === 0) {
        try {
          var data = JSON.parse(localStorage.getItem(key));

          if (data && data.days) {
            data.days.forEach(function(day) {
              agg.calls += day.calls.filter(Boolean).length;
              agg.linkedin += day.linkedin.filter(Boolean).length;
              agg.emails += day.emails.filter(Boolean).length;
            });
            weeks++;
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }

    if (weeks === 0) {
      return { calls: 0, linkedin: 0, emails: 0 };
    }

    var totalDays = weeks * 5;

    return {
      calls: (agg.calls / totalDays).toFixed(1),
      linkedin: (agg.linkedin / totalDays).toFixed(1),
      emails: (agg.emails / totalDays).toFixed(1)
    };
  }

  // Public API
  return {
    getCurrentWeekKey: getCurrentWeekKey,
    getWeekKey: getWeekKey,
    getWeekData: getWeekData,
    saveWeekData: saveWeekData,
    recordTouch: recordTouch,
    getCurrentWeekTotals: getCurrentWeekTotals,
    getAllTimeAverages: getAllTimeAverages,
    getDayIndex: getDayIndex
  };
})();
