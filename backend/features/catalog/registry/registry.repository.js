/**
 * The registry spreadsheet: one row per form, plus shared lists and clients.
 * Each form also owns a separate spreadsheet for its responses.
 */

var RegistryRepository = (function () {
  /** The name of the Drive folder that holds every form's files. */
  var ROOT_FOLDER_NAME_ = 'Forms Platform';

  /**
   * Opens the registry spreadsheet: the one setup stored, or the one the
   * script is bound to before setup has run.
   *
   * @return {!SpreadsheetApp.Spreadsheet} The registry.
   */
  function registry() {
    var id = Properties.getProp(Constants.PROPS.REGISTRY_ID);
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  }

  /**
   * Opens the Drive folder of the platform, and makes it again when it is
   * missing or cannot be opened.
   *
   * @return {!DriveApp.Folder} The folder.
   */
  function rootFolder() {
    var id = Properties.getProp(Constants.PROPS.ROOT_FOLDER_ID);
    if (id) {
      try {
        return DriveApp.getFolderById(id);
      } catch (e) {
        /* recreate below */
      }
    }
    var f = DriveApp.createFolder(ROOT_FOLDER_NAME_);
    Properties.setProp(Constants.PROPS.ROOT_FOLDER_ID, f.getId());
    return f;
  }

  return { registry, rootFolder };
})();
