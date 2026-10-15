/** Creating the registry tabs and folder the first time. */

/** First-time setup. Safe to run again. */
function setup() {
  var ss = registry();
  Properties.setProp('REGISTRY_ID', ss.getId());
  Properties.pepper();
  Table.ensureTab(ss, Constants.TABS.forms, FORM_COLS);
  Table.ensureTab(ss, Constants.TABS.clients, CLIENT_COLS_);
  var lists = Table.ensureTab(ss, Constants.TABS.lists, ['key', 'values']);
  if (lists.getLastRow() < 2) {
    Object.keys(DEFAULT_LISTS).forEach(function (k) {
      Table.appendPlain(lists, [
        k,
        JSON.stringify(normalizeListValues(DEFAULT_LISTS[k]))
      ]);
    });
  }
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1)
    ss.deleteSheet(blank);
  SheetStyle.styleRegistryTabs();
  rootFolder();
  return { registryUrl: ss.getUrl(), folderId: Properties.getProp('ROOT_FOLDER_ID') };
}
