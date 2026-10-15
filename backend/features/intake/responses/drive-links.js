/**
 * Checking the Drive links a submission names: shared, and named as the form
 * asks.
 */

var DriveLinks = (function () {
  /** The sharing settings that let anyone with the link open an item. */
  var PUBLIC_ACCESS_ = ['ANYONE', 'ANYONE_WITH_LINK'];

  /**
   * Opens the Drive item a parsed link names.
   *
   * @param {{kind: string, id: string}} p The parsed link.
   * @return {?Object} The file or folder, or null when the script cannot
   *     open it.
   */
  function openItem_(p) {
    try {
      return p.kind === 'folder'
        ? DriveApp.getFolderById(p.id)
        : DriveApp.getFileById(p.id);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Reads who may open a Drive item.
   *
   * @param {!Object} item The file or folder.
   * @return {?string} Its sharing access, or null when Drive does not say.
   */
  function accessOf_(item) {
    try {
      return String(item.getSharingAccess());
    } catch (_e) {
      return null;
    }
  }

  /**
   * Checks the name of a project folder.
   *
   * @param {!Object} item The folder.
   * @param {!Object} naming The naming rule.
   * @return {{ok: boolean}} The result; ok when the name cannot be read.
   */
  function checkName_(item, naming) {
    var name;
    try {
      name = String(item.getName());
    } catch (_e) {
      return { ok: true };
    }
    var r = Rules.checkFolderName(name, naming);
    return r.ok ? { ok: true } : r;
  }

  /**
   * Checks one Drive link: it opens, anyone with the link may open it, and a
   * folder is named as the form asks.
   *
   * @param {string} link The link.
   * @param {?Object} naming The naming rule for folders, or null.
   * @return {{ok: boolean, error: (string|undefined)}} The result.
   */
  function checkDriveLink_(link, naming) {
    var p = Rules.parseDriveLink(link);
    if (!p.ok) return { ok: false, error: 'invalid_link' };
    var item = openItem_(p);
    if (!item) return { ok: false, error: 'link_unreachable' };
    var access = accessOf_(item);
    if (access && PUBLIC_ACCESS_.indexOf(access) === -1)
      return { ok: false, error: 'link_not_public' };
    if (naming && p.kind === 'folder') return checkName_(item, naming);
    return { ok: true };
  }

  /**
   * Gives the naming rule for project folders.
   *
   * @param {!Object} form The form.
   * @param {?Object} data The answers, for the example name.
   * @return {?Object} The rule, or null when it is off.
   */
  function folderNaming_(form, data) {
    var fn = form.rules?.folderName;
    if (!fn?.enabled) return null;
    return {
      subject: String(fn.subject || ''),
      example: { project: Rules.valueByRole(form, data || {}, 'title') }
    };
  }

  /**
   * Checks every Drive link of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} data The answers.
   * @throws {ApiError} `invalid`, with the error of each bad link.
   */
  function checkDriveFields_(form, data) {
    if (form.rules?.driveCheck === 'off') return;
    var naming = folderNaming_(form, data);
    var errors = {};
    form.fields.forEach(function (f) {
      if (f.type !== 'drive_link' || f.enabled === false || !data[f.id]) return;
      var r = checkDriveLink_(data[f.id], naming);
      if (!r.ok) errors[f.id] = { error: r.error, params: r.params };
    });
    if (Object.keys(errors).length)
      ApiError.fail('invalid', 'Check the Google Drive links.', errors);
  }

  return { checkDriveFields: checkDriveFields_ };
})();
