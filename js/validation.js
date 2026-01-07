// Data Validation Module
window.Validation = (function() {
  // Rule definitions by template and field
  var Rules = {
    'Client': {
      'Email': {
        type: 'email',
        required: false,
        message: 'Invalid email format (example: user@domain.com)'
      },
      'Birthday': {
        type: 'pastDate',
        required: false,
        message: 'Birthday cannot be in the future'
      },
      'Last Contact': {
        type: 'pastOrTodayDate',
        required: false,
        message: 'Last Contact cannot be in the future'
      },
      'Next Contact': {
        type: 'dateRange',
        after: 'Last Contact',
        required: false,
        message: 'Next Contact must be after Last Contact'
      },
      'Cell Number': {
        type: 'phone',
        format: 'XXX XXX XXXX',
        required: false,
        message: 'Phone format: 403 299 5029'
      },
      'AUM': {
        type: 'currency',
        required: false,
        message: 'Must be a valid number'
      }
    },
    'COI': {
      'Email': {
        type: 'email',
        required: false,
        message: 'Invalid email format'
      },
      'Birthday': {
        type: 'pastDate',
        required: false,
        message: 'Birthday cannot be in the future'
      },
      'Last Contact': {
        type: 'pastOrTodayDate',
        required: false,
        message: 'Last Contact cannot be in the future'
      },
      'Next Contact': {
        type: 'dateRange',
        after: 'Last Contact',
        required: false,
        message: 'Next Contact must be after Last Contact'
      },
      'Cell Number': {
        type: 'phone',
        format: 'XXX XXX XXXX',
        required: false,
        message: 'Phone format: 403 299 5029'
      }
    },
    'Opportunity': {
      'Email': {
        type: 'email',
        required: false,
        message: 'Invalid email format'
      },
      'Birthday': {
        type: 'pastDate',
        required: false,
        message: 'Birthday cannot be in the future'
      },
      'Last Contact': {
        type: 'pastOrTodayDate',
        required: false,
        message: 'Last Contact cannot be in the future'
      },
      'Next Contact': {
        type: 'dateRange',
        after: 'Last Contact',
        required: false,
        message: 'Next Contact must be after Last Contact'
      },
      'Cell Number': {
        type: 'phone',
        format: 'XXX XXX XXXX',
        required: false,
        message: 'Phone format: 403 299 5029'
      }
    }
  };

  // Validator functions
  var Validators = {
    email: function(value) {
      // RFC 5322 simplified regex for email validation
      var re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return !value || re.test(value.trim());
    },

    phone: function(value, rule) {
      // Format: "403 299 5029" (3 digits, space, 3 digits, space, 4 digits)
      if (!value) return true;
      var re = /^\d{3} \d{3} \d{4}$/;
      return re.test(value.trim());
    },

    pastDate: function(value) {
      if (!value) return true;
      var date = new Date(value);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return date <= today;
    },

    pastOrTodayDate: function(value) {
      if (!value) return true;
      var date = new Date(value);
      var today = new Date();
      today.setHours(23, 59, 59, 999);
      return date <= today;
    },

    dateRange: function(value, rule, allFields) {
      if (!value || !rule.after) return true;
      var afterValue = allFields[rule.after];
      if (!afterValue) return true;
      return new Date(value) >= new Date(afterValue);
    },

    currency: function(value) {
      if (!value) return true;
      var cleaned = String(value).replace(/[,$]/g, '');
      return !isNaN(parseFloat(cleaned));
    }
  };

  // Validate single field
  function validateField(template, fieldName, value, allFields) {
    var templateRules = Rules[template];
    if (!templateRules || !templateRules[fieldName]) {
      return { valid: true };
    }

    var rule = templateRules[fieldName];
    var validator = Validators[rule.type];

    if (!validator) {
      return { valid: true };
    }

    var isValid = validator(value, rule, allFields);

    return {
      valid: isValid,
      message: isValid ? null : rule.message
    };
  }

  // Validate all fields in a node
  function validateNode(node) {
    var errors = {};
    var hasErrors = false;

    if (!node.fields) return { valid: true, errors: {} };

    for (var key in node.fields) {
      if (!node.fields.hasOwnProperty(key)) continue;

      var result = validateField(node.template, key, node.fields[key], node.fields);
      if (!result.valid) {
        errors[key] = result.message;
        hasErrors = true;
      }
    }

    return {
      valid: !hasErrors,
      errors: errors
    };
  }

  // Public API
  return {
    validateField: validateField,
    validateNode: validateNode,
    Rules: Rules
  };
})();
