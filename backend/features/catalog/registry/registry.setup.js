/** Creating the registry tabs and folder the first time. */

/** First-time setup. Safe to run again. */
function setup() {
  var ss = registry();
  setProp('REGISTRY_ID', ss.getId());
  pepper();
  ensureTab(ss, TABS.forms, FORM_COLS);
  ensureTab(ss, TABS.clients, CLIENT_COLS_);
  var lists = ensureTab(ss, TABS.lists, ['key', 'values']);
  if (lists.getLastRow() < 2) {
    Object.keys(DEFAULT_LISTS).forEach(function (k) {
      appendPlain_(lists, [
        k,
        JSON.stringify(normalizeListValues(DEFAULT_LISTS[k]))
      ]);
    });
  }
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1)
    ss.deleteSheet(blank);
  styleRegistryTabs_();
  rootFolder();
  return { registryUrl: ss.getUrl(), folderId: getProp('ROOT_FOLDER_ID') };
}
