// Touch Tracker Modal - Categorize client touches
window.TouchTracker = (function() {
  var dom = window.DOM;
  var selectedChannel = null;

  // Show toast notification
  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(function() {
      toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Open touch categorization modal
  function openTouchModal() {
    selectedChannel = null;

    // Reset radio buttons
    var radios = window.Utils.$$('input[name="touchChannel"]');
    radios.forEach(function(radio) {
      radio.checked = false;
    });

    // Show modal
    dom.touchBackdrop.style.display = 'flex';
    dom.touchBackdrop.setAttribute('aria-hidden', 'false');
  }

  // Close modal
  function closeTouchModal() {
    dom.touchBackdrop.style.display = 'none';
    dom.touchBackdrop.setAttribute('aria-hidden', 'true');
    selectedChannel = null;
  }

  // Record touch
  function recordTouch() {
    if (!selectedChannel) {
      alert('Please select a touch category');
      return;
    }

    var result = window.Analytics.recordTouch(selectedChannel);

    if (result.success) {
      showToast('Touch recorded: ' + selectedChannel + ' (' + result.count + '/20 today)');
      closeTouchModal();
    } else {
      alert(result.error || 'Failed to record touch');
    }
  }

  // Initialize event handlers
  function init() {
    // Radio button change handlers
    var radios = window.Utils.$$('input[name="touchChannel"]');
    radios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        if (this.checked) {
          selectedChannel = this.value;
        }
      });
    });

    // Button handlers
    dom.skipTouchBtn.onclick = closeTouchModal;
    dom.recordTouchBtn.onclick = recordTouch;

    // Click backdrop to close
    dom.touchBackdrop.addEventListener('click', function(e) {
      if (e.target === dom.touchBackdrop) {
        closeTouchModal();
      }
    });
  }

  // Public API
  return {
    openTouchModal: openTouchModal,
    closeTouchModal: closeTouchModal,
    recordTouch: recordTouch,
    init: init
  };
})();
