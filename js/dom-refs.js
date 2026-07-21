// DOM Element References
window.DOM = (function() {
  var $ = window.Utils.$;

  return {
    // Stage elements
    stageWrap: $('#stageWrap'),
    stage: $('#stage'),
    linkLayer: $('#linkLayer'),
    nodeLayer: $('#nodeLayer'),

    // View toggle buttons
    viewMindBtn: $('#viewMind'),
    viewListBtn: $('#viewList'),
    viewAnalyticsBtn: $('#viewAnalytics'),

    // Toolbar buttons
    addRootBtn: $('#addRoot'),
    shortcutsBtn: $('#shortcutsBtn'),
    addChildBtn: $('#addChild'),
    editNodeBtn: $('#editNode'),
    toggleHighlightBtn: $('#toggleHighlight'),
    deleteNodeBtn: $('#deleteNode'),
    foldBtn: $('#foldBtn'),
    distributeBtn: $('#distributeBtn'),
    templateSelect: $('#templateSelect'),
    searchInput: $('#search'),
    defaultOffsetInput: $('#defaultOffset'),

    // Zoom controls
    zoomInBtn: $('#zoomIn'),
    zoomOutBtn: $('#zoomOut'),
    zoomResetBtn: $('#zoomReset'),

    // Save/Load
    saveBtn: $('#saveBtn'),
    loadBtn: $('#loadBtn'),
    fileInput: $('#fileInput'),
    crmFolderBtn: $('#crmFolderBtn'),
    restoreFromFolderBtn: $('#restoreFromFolderBtn'),

    // Backup reminder popup (floating, non-modal)
    backupReminderPopup: $('#backupReminderPopup'),
    dismissBackupReminderBtn: $('#dismissBackupReminder'),
    closeBackupReminderBtn: $('#closeBackupReminder'),

    // List view
    listView: $('#listView'),
    mindmapView: $('#mindmapView'),
    analyticsView: $('#analyticsView'),
    taskList: $('#taskList'),
    listSort: $('#listSort'),
    statusFilters: $('#statusFilters'),

    // Editor modal
    editorBackdrop: $('#editorBackdrop'),
    f_title: $('#f_title'),
    f_template: $('#f_template'),
    f_status: $('#f_status'),
    f_due: $('#f_due'),
    f_notes: $('#f_notes'),
    f_freq: $('#f_freq'),
    f_lastcontact: $('#f_lastcontact'),
    f_nextcontact: $('#f_nextcontact'),
    kvArea: $('#kvArea'),
    addKVBtn: $('#addKV'),
    cancelEditBtn: $('#cancelEdit'),
    saveEditBtn: $('#saveEdit'),
    successBtn: $('#successBtn'),
    colorPalette: $('#colorPalette'),
    bgColorPalette: $('#bgColorPalette'),
    importAccountsBtn: $('#importAccounts'),

    // Task Channel field
    availableDetailsField: $('#availableDetailsField'),

    // Task Channel radio buttons
    touch_calls: $('#touch_calls'),
    touch_linkedin: $('#touch_linkedin'),
    touch_emails: $('#touch_emails'),

    // Backups modal
    backupsBackdrop: $('#backupsBackdrop'),
    backupsList: $('#backupsList'),
    closeBackupsBtn: $('#closeBackups'),
    backupsBtn: $('#backupsBtn'),

    // Mailing modal
    mailingBackdrop: $('#mailingBackdrop'),
    mailingBtn: $('#mailingBtn'),
    audienceSel: $('#audience'),
    tagsFilter: $('#tagsFilter'),
    mailingPreview: $('#mailingPreview'),
    refreshPreviewBtn: $('#refreshPreview'),
    downloadCSVBtn: $('#downloadCSV'),
    closeMailingBtn: $('#closeMailing'),

    // Import modal
    importBtn: $('#importBtn'),
    importBackdrop: $('#importBackdrop'),
    importTemplateBox: $('#importTemplateBox'),
    copyImportTemplateBtn: $('#copyImportTemplateBtn'),
    importCsvText: $('#importCsvText'),
    importFileInput: $('#importFileInput'),
    loadImportFileBtn: $('#loadImportFileBtn'),
    previewImportBtn: $('#previewImportBtn'),
    importPreviewList: $('#importPreviewList'),
    confirmImportBtn: $('#confirmImportBtn'),
    closeImportBtn: $('#closeImportBtn'),

    // Search help modal
    searchHelpBackdrop: $('#searchHelpBackdrop'),
    searchHelpBtn: $('#searchHelpBtn'),
    closeSearchHelpBtn: $('#closeSearchHelp'),

    // Shortcuts modal
    shortcutsBackdrop: $('#shortcutsBackdrop'),
    closeShortcutsBtn: $('#closeShortcuts'),

    // Background color picker modal
    bgColorBackdrop: $('#bgColorBackdrop'),
    bgColorBtn: $('#bgColorBtn'),
    bgColorPicker: $('#bgColorPicker'),
    bgColorHex: $('#bgColorHex'),
    bgColorPreview: $('#bgColorPreview'),
    clearBgColorBtn: $('#clearBgColor'),
    cancelBgColorBtn: $('#cancelBgColor'),
    applyBgColorBtn: $('#applyBgColor'),

    // Stats
    statContacts: $('#statContacts'),
    statAUM: $('#statAUM'),
    statTasks: $('#statTasks'),
    statTouches: $('#statTouches')
  };
})();
