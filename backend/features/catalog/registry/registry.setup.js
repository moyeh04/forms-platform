/** Creating the registry tabs and folder the first time, and their look. */

var RegistrySetup = (function () {
  /**
   * Sets up the registry the first time: its tabs, the default lists, the
   * pepper and the folder. Safe to run again.
   *
   * @return {{registryUrl: string, folderId: ?string}} The registry's
   *     address and the id of the Drive folder.
   */
  function setup() {
    var ss = RegistryRepository.registry();
    Properties.setProp(Constants.PROPS.REGISTRY_ID, ss.getId());
    Properties.pepper();
    Table.ensureTab(ss, Constants.TABS.forms, FormsRepository.FORM_COLS);
    Table.ensureTab(ss, Constants.TABS.clients, ClientsRepository.CLIENT_COLS);
    var lists = Table.ensureTab(ss, Constants.TABS.lists, ['key', 'values']);
    if (lists.getLastRow() < 2) {
      Object.keys(ListsRules.DEFAULT_LISTS).forEach(function (k) {
        Table.appendPlain(lists, [
          k,
          JSON.stringify(
            ListsRules.normalizeListValues(ListsRules.DEFAULT_LISTS[k])
          )
        ]);
      });
    }
    var blank = ss.getSheetByName('Sheet1');
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1)
      ss.deleteSheet(blank);
    styleRegistryTabs();
    RegistryRepository.rootFolder();
    return {
      registryUrl: ss.getUrl(),
      folderId: Properties.getProp(Constants.PROPS.ROOT_FOLDER_ID)
    };
  }

  /** Gives the three tabs of the registry their look. */
  function styleRegistryTabs() {
    var ss = RegistryRepository.registry();
    SheetStyle.styleDataTab(
      ss.getSheetByName(Constants.TABS.forms),
      FormsRepository.FORM_COLS
    );
    SheetStyle.styleDataTab(
      ss.getSheetByName(Constants.TABS.clients),
      ClientsRepository.CLIENT_COLS
    );
    SheetStyle.styleDataTab(ss.getSheetByName(Constants.TABS.lists), [
      'key',
      'values'
    ]);
  }

  return { setup, styleRegistryTabs };
})();
