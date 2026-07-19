// File-backed Persistence - writes a live copy of the map to a user-chosen
// folder on disk (File System Access API) as a second, independent leg
// alongside localStorage. Chrome/Edge only; no-ops entirely if unsupported.
window.FilePersistence = (function() {
  var config = window.AppConfig;

  var DB_NAME = 'wm-file-persistence';
  var STORE_NAME = 'handles';
  var HANDLE_KEY = 'crmFolder';
  var FILE_NAME = 'crm-live-database.json';
  var SUPPORTED = 'showDirectoryPicker' in window;

  var dirHandle = null;
  var writeTimer = null;

  function openDb() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function() {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function idbGet(key) {
    return openDb().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function idbSet(key, value) {
    return openDb().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function setStatus(status) {
    var btn = window.DOM && window.DOM.crmFolderBtn;
    if(!btn) return;
    if(status === 'unsupported') {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    btn.classList.remove('accent', 'danger');
    if(status === 'connected') {
      btn.textContent = 'CRM Folder ✓';
      btn.title = 'Connected - writing to your chosen folder';
    } else if(status === 'needs-permission') {
      btn.textContent = 'CRM Folder ⚠';
      btn.classList.add('danger');
      btn.title = 'Click to reconnect folder permission';
    } else {
      btn.textContent = 'CRM Folder';
      btn.title = 'Choose a folder to back up saves to. Suggested: ' + (config.CrmFolderHint || '');
    }
  }

  function chooseDirectory() {
    if(!SUPPORTED) return Promise.resolve(false);
    return window.showDirectoryPicker({id: 'crm-folder', mode: 'readwrite'}).then(function(handle) {
      dirHandle = handle;
      setStatus('connected');
      return idbSet(HANDLE_KEY, handle).then(function() { return true; });
    }).catch(function() { return false; });
  }

  function reconnect() {
    if(!dirHandle) return chooseDirectory();
    return dirHandle.requestPermission({mode: 'readwrite'}).then(function(perm) {
      if(perm === 'granted') {
        setStatus('connected');
        return true;
      }
      setStatus('needs-permission');
      return false;
    }).catch(function() { return false; });
  }

  function init() {
    if(!SUPPORTED) {
      setStatus('unsupported');
      return Promise.resolve();
    }
    return idbGet(HANDLE_KEY).then(function(handle) {
      if(!handle) {
        setStatus('disconnected');
        return;
      }
      dirHandle = handle;
      return handle.queryPermission({mode: 'readwrite'}).then(function(perm) {
        setStatus(perm === 'granted' ? 'connected' : 'needs-permission');
      });
    }).catch(function() {
      setStatus('disconnected');
    });
  }

  function writeNow(payload) {
    if(!dirHandle) return Promise.resolve(false);
    return dirHandle.getFileHandle(FILE_NAME, {create: true}).then(function(fileHandle) {
      return fileHandle.createWritable();
    }).then(function(writable) {
      return writable.write(JSON.stringify(payload)).then(function() {
        return writable.close();
      });
    }).then(function() { return true; }).catch(function() { return false; });
  }

  function scheduleWrite(payload) {
    if(!SUPPORTED || !dirHandle) return;
    if(writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(function() {
      writeNow(payload);
    }, 2000);
  }

  function readSnapshot() {
    if(!dirHandle) return Promise.resolve(null);
    return dirHandle.getFileHandle(FILE_NAME).then(function(fileHandle) {
      return fileHandle.getFile();
    }).then(function(file) {
      return file.text();
    }).then(function(text) {
      try { return JSON.parse(text); } catch(e) { return null; }
    }).catch(function() { return null; });
  }

  function handleButtonClick() {
    if(!dirHandle) {
      chooseDirectory();
    } else {
      dirHandle.queryPermission({mode: 'readwrite'}).then(function(perm) {
        if(perm === 'granted') {
          chooseDirectory(); // already connected - let the user pick a different folder
        } else {
          reconnect();
        }
      });
    }
  }

  function initButton() {
    var btn = window.DOM && window.DOM.crmFolderBtn;
    if(btn) btn.onclick = handleButtonClick;
  }

  return {
    isSupported: function() { return SUPPORTED; },
    init: init,
    initButton: initButton,
    chooseDirectory: chooseDirectory,
    reconnect: reconnect,
    scheduleWrite: scheduleWrite,
    readSnapshot: readSnapshot
  };
})();
