// File-backed Persistence - writes a live copy of the map to a user-chosen
// folder on disk (File System Access API) as the real backup mechanism,
// alongside localStorage as a fallback for when no folder is connected.
// Chrome/Edge only; no-ops entirely if unsupported.
window.FilePersistence = (function() {
  var config = window.AppConfig;

  var DB_NAME = 'wm-file-persistence';
  var STORE_NAME = 'handles';
  var HANDLE_KEY = 'crmFolder';
  var FILE_NAME = 'crm-live-database.json';
  var BACKUPS_DIR = 'backups';
  var MAX_FOLDER_BACKUPS = 10;
  var SUPPORTED = 'showDirectoryPicker' in window;

  var dirHandle = null;
  var writeTimer = null;
  var lastPayload = null;

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
    } else if(status === 'error') {
      btn.textContent = 'CRM Folder ✗';
      btn.classList.add('danger');
      btn.title = 'Last write failed - click to reconnect';
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
      return idbSet(HANDLE_KEY, handle).then(function() {
        // Write the current state immediately - don't wait for the next edit.
        if(window.Storage) window.Storage.markDirty();
        flushPending();
        return true;
      });
    }).catch(function(err) {
      console.error('FilePersistence: chooseDirectory failed', err);
      return false;
    });
  }

  function reconnect() {
    if(!dirHandle) return chooseDirectory();
    return dirHandle.requestPermission({mode: 'readwrite'}).then(function(perm) {
      if(perm === 'granted') {
        setStatus('connected');
        if(window.Storage) window.Storage.markDirty();
        flushPending();
        return true;
      }
      setStatus('needs-permission');
      return false;
    }).catch(function(err) {
      console.error('FilePersistence: reconnect failed', err);
      return false;
    });
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
    }).catch(function(err) {
      console.error('FilePersistence: init failed', err);
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
    }).then(function() {
      setStatus('connected');
      return true;
    }).catch(function(err) {
      console.error('FilePersistence: writeNow failed', err);
      setStatus('error');
      return false;
    });
  }

  function scheduleWrite(payload) {
    if(!SUPPORTED || !dirHandle) return;
    lastPayload = payload;
    if(writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(function() {
      writeTimer = null;
      writeNow(payload);
    }, 2000);
  }

  // Cancel any pending debounced write and do it immediately - used on
  // tab hide/close (where a 2s debounce would otherwise lose the write)
  // and right after connecting/reconnecting a folder.
  function flushPending() {
    if(writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    if(dirHandle && lastPayload) {
      writeNow(lastPayload);
    }
  }

  function readSnapshot() {
    if(!dirHandle) return Promise.resolve(null);
    return dirHandle.getFileHandle(FILE_NAME).then(function(fileHandle) {
      return fileHandle.getFile();
    }).then(function(file) {
      return file.text();
    }).then(function(text) {
      try { return JSON.parse(text); } catch(e) { return null; }
    }).catch(function(err) {
      console.error('FilePersistence: readSnapshot failed', err);
      return null;
    });
  }

  // Rotating timestamped snapshots, written into a "backups" subdirectory
  // of the connected folder - this is what actually backs the "Backups"
  // modal now, replacing the quota-fragile localStorage array.
  function snapshotToFolder(payload, reason) {
    if(!dirHandle) return Promise.resolve(false);
    return dirHandle.getDirectoryHandle(BACKUPS_DIR, {create: true}).then(function(backupsDir) {
      var name = 'backup-' + Date.now() + '-' + (reason || 'auto') + '.json';
      return backupsDir.getFileHandle(name, {create: true}).then(function(fileHandle) {
        return fileHandle.createWritable();
      }).then(function(writable) {
        return writable.write(JSON.stringify(payload)).then(function() {
          return writable.close();
        });
      }).then(function() {
        return pruneFolderBackups(backupsDir);
      }).then(function() { return true; });
    }).catch(function(err) {
      console.error('FilePersistence: snapshotToFolder failed', err);
      return false;
    });
  }

  // Keep only the newest MAX_FOLDER_BACKUPS entries in the backups directory.
  async function pruneFolderBackups(backupsDir) {
    var names = [];
    for await (var entry of backupsDir.entries()) {
      if(entry[1].kind === 'file') names.push(entry[0]);
    }
    names.sort(function(a, b) { return parseBackupTs(b) - parseBackupTs(a); });
    for(var i = MAX_FOLDER_BACKUPS; i < names.length; i++) {
      try { await backupsDir.removeEntry(names[i]); } catch(e) {}
    }
  }

  function parseBackupTs(name) {
    var m = /^backup-(\d+)-/.exec(name);
    return m ? parseInt(m[1], 10) : 0;
  }

  function listFolderBackups() {
    if(!dirHandle) return Promise.resolve([]);
    return dirHandle.getDirectoryHandle(BACKUPS_DIR, {create: true}).then(function(backupsDir) {
      return (async function() {
        var out = [];
        for await (var entry of backupsDir.entries()) {
          var name = entry[0], handle = entry[1];
          if(handle.kind !== 'file') continue;
          var m = /^backup-(\d+)-([a-z]+)\.json$/.exec(name);
          out.push({name: name, ts: m ? parseInt(m[1], 10) : 0, reason: m ? m[2] : 'auto'});
        }
        out.sort(function(a, b) { return b.ts - a.ts; });
        return out;
      })();
    }).catch(function(err) {
      console.error('FilePersistence: listFolderBackups failed', err);
      return [];
    });
  }

  function readFolderBackup(name) {
    if(!dirHandle) return Promise.resolve(null);
    return dirHandle.getDirectoryHandle(BACKUPS_DIR, {create: true}).then(function(backupsDir) {
      return backupsDir.getFileHandle(name);
    }).then(function(fileHandle) {
      return fileHandle.getFile();
    }).then(function(file) {
      return file.text();
    }).then(function(text) {
      try { return JSON.parse(text); } catch(e) { return null; }
    }).catch(function(err) {
      console.error('FilePersistence: readFolderBackup failed', err);
      return null;
    });
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
    isConnected: function() { return !!dirHandle; },
    init: init,
    initButton: initButton,
    chooseDirectory: chooseDirectory,
    reconnect: reconnect,
    scheduleWrite: scheduleWrite,
    flushPending: flushPending,
    readSnapshot: readSnapshot,
    snapshotToFolder: snapshotToFolder,
    listFolderBackups: listFolderBackups,
    readFolderBackup: readFolderBackup
  };
})();
