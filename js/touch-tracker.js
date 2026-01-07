// Touch Tracker - Toast Notifications
window.TouchTracker = (function() {
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

  // Public API
  return {
    showToast: showToast
  };
})();
