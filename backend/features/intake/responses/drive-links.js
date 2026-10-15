/**
 * Checking the Drive links a submission names: shared, and named as the form
 * asks.
 */

function checkDriveLink_(link, naming) {
  var p = Rules.parseDriveLink(link);
  if (!p.ok) return { ok: false, error: 'invalid_link' };
  var item;
  try {
    item =
      p.kind === 'folder'
        ? DriveApp.getFolderById(p.id)
        : DriveApp.getFileById(p.id);
  } catch (e) {
    return { ok: false, error: 'link_unreachable' };
  }
  var access = null;
  try {
    access = String(item.getSharingAccess());
  } catch (e) {
    access = null;
  }
  if (access && access !== 'ANYONE' && access !== 'ANYONE_WITH_LINK')
    return { ok: false, error: 'link_not_public' };
  if (naming && p.kind === 'folder') {
    var name = '';
    try {
      name = String(item.getName());
    } catch (e) {
      return { ok: true };
    }
    var r = Rules.checkFolderName(name, naming);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/** The naming rule for project folders, or null when it is off. */
function folderNaming_(form, data) {
  var fn = form.rules && form.rules.folderName;
  if (!fn || !fn.enabled) return null;
  return {
    subject: String(fn.subject || ''),
    example: { project: Rules.valueByRole(form, data || {}, 'title') }
  };
}

function checkDriveFields_(form, data) {
  if (form.rules && form.rules.driveCheck === 'off') return;
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
