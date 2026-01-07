// Advanced Search & Filtering
window.SearchAdvanced = (function() {
  var utils = window.Utils;
  var state = window.AppState;
  var dom = window.DOM;
  var nodeOps = window.NodeOps;

  // Parse search query into criteria
  function parseQuery(query) {
    query = (query || '').trim();
    if (!query) {
      return { mode: 'none', criteria: [] };
    }

    var criteria = [];
    var tokens = query.split(/\s+/);

    tokens.forEach(function(token) {
      if (token.indexOf(':') !== -1) {
        // Field-specific search
        var parts = token.split(':');
        var field = parts[0].toLowerCase();
        var value = parts.slice(1).join(':');

        // Check for comparison operators
        var operator = '=';
        if (value.length > 0) {
          if (value[0] === '>') {
            operator = '>';
            value = value.substring(1);
          } else if (value[0] === '<') {
            operator = '<';
            value = value.substring(1);
          } else if (value[0] === '*') {
            operator = 'contains';
            value = value.substring(1);
          }
        }

        criteria.push({
          type: 'field',
          field: field,
          value: value.toLowerCase(),
          operator: operator
        });
      } else {
        // Simple substring search
        criteria.push({
          type: 'simple',
          value: token.toLowerCase()
        });
      }
    });

    return {
      mode: criteria.length > 0 ? 'search' : 'none',
      criteria: criteria
    };
  }

  // Get field value from node (case-insensitive field matching)
  function getFieldValue(node, fieldName) {
    fieldName = fieldName.toLowerCase();

    // Map common field names
    var fieldMap = {
      'template': node.template || '',
      'status': node.status || '',
      'title': node.title || '',
      'due': node.due || '',
      'notes': node.notes || '',
      'freq': node.freq || ''
    };

    // Check mapped fields first
    if (fieldMap[fieldName] !== undefined) {
      return String(fieldMap[fieldName]).toLowerCase();
    }

    // Check custom fields (case-insensitive)
    if (node.fields) {
      for (var key in node.fields) {
        if (Object.prototype.hasOwnProperty.call(node.fields, key)) {
          if (key.toLowerCase() === fieldName) {
            return String(node.fields[key]).toLowerCase();
          }
        }
      }
    }

    return '';
  }

  // Get all searchable text from node
  function getSearchableText(node) {
    var parts = [
      node.title || '',
      node.template || '',
      node.status || '',
      node.due || '',
      node.notes || ''
    ];

    if (node.fields) {
      for (var k in node.fields) {
        if (Object.prototype.hasOwnProperty.call(node.fields, k)) {
          parts.push(String(node.fields[k]));
        }
      }
    }

    return parts.join(' ').toLowerCase();
  }

  // Check if a node matches a single criterion
  function matchCriterion(node, criterion) {
    if (criterion.type === 'simple') {
      return getSearchableText(node).indexOf(criterion.value) !== -1;
    }

    if (criterion.type === 'field') {
      var fieldValue = getFieldValue(node, criterion.field);

      if (criterion.operator === '=') {
        return fieldValue.indexOf(criterion.value) !== -1;
      }

      if (criterion.operator === 'contains') {
        return fieldValue.indexOf(criterion.value) !== -1;
      }

      // Numeric comparisons
      if (criterion.operator === '>' || criterion.operator === '<') {
        // Remove currency symbols and commas
        var numericValue = parseFloat(fieldValue.replace(/[$,]/g, ''));
        var targetValue = parseFloat(criterion.value.replace(/[$,]/g, ''));

        if (isNaN(numericValue) || isNaN(targetValue)) {
          return false;
        }

        if (criterion.operator === '>') {
          return numericValue > targetValue;
        }
        if (criterion.operator === '<') {
          return numericValue < targetValue;
        }
      }
    }

    return false;
  }

  // Check if a node matches all criteria (AND logic)
  function matchNode(node, parsedQuery) {
    if (parsedQuery.mode === 'none') {
      return true;
    }

    // All criteria must match (AND logic)
    for (var i = 0; i < parsedQuery.criteria.length; i++) {
      if (!matchCriterion(node, parsedQuery.criteria[i])) {
        return false;
      }
    }

    return true;
  }

  // Apply search to mind map view
  function applyToMindMap(query) {
    var parsedQuery = parseQuery(query);
    var firstHit = null;

    utils.$$('.node', dom.nodeLayer).forEach(function(el) {
      var id = el.dataset.id;
      var node = nodeOps.findNode(id).node;
      var match = matchNode(node, parsedQuery);

      el.style.filter = match ? 'none' : 'grayscale(0.2)';
      el.style.opacity = match ? '1' : '0.45';

      if (!firstHit && match) {
        firstHit = el;
      }
    });

    // Select first match
    if (firstHit) {
      window.Render.selectNode(firstHit.dataset.id);
      window.Render.highlightSelection();
    }
  }

  // Apply search to task list view
  function applyToTaskList(query) {
    var parsedQuery = parseQuery(query);

    utils.$$('.task-item', dom.taskList).forEach(function(el) {
      var id = el.dataset.id;
      var node = nodeOps.findNode(id).node;
      var match = matchNode(node, parsedQuery);

      el.style.display = match ? '' : 'none';
    });
  }

  // Public API
  return {
    parseQuery: parseQuery,
    matchNode: matchNode,
    applyToMindMap: applyToMindMap,
    applyToTaskList: applyToTaskList
  };
})();
