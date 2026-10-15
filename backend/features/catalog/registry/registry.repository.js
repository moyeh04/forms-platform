/**
 * The registry spreadsheet: one row per form, plus shared lists and clients.
 * Each form also owns a separate spreadsheet for its responses.
 */

function registry() {
  var id = Properties.getProp('REGISTRY_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function rootFolder() {
  var id = Properties.getProp('ROOT_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      /* recreate below */
    }
  }
  var f = DriveApp.createFolder('Forms Platform');
  Properties.setProp('ROOT_FOLDER_ID', f.getId());
  return f;
}
