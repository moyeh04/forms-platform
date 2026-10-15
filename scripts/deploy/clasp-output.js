/** Reads what clasp prints when it creates a project or a deployment. */

/** A Script ID or a deployment ID: letters, digits, `_` and `-`. */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Reads the deployment ID that clasp printed. clasp prints
 * "Deployed <id> @<version>"; the ID is the only long token before the
 * version.
 *
 * @param {string} output What clasp printed.
 * @return {string} The deployment ID.
 * @throws {Error} When clasp printed none.
 */
function deploymentId(output) {
  const match = /([A-Za-z0-9_-]{20,})\s+@\d+/.exec(output || '');
  if (!match)
    throw new Error(
      'clasp did not report a deployment ID. Its output was:\n' +
        (output || '(empty)')
    );
  return match[1];
}

/**
 * Reads the project that `clasp create --json` made. It prints one object;
 * anything around it is progress text.
 *
 * @param {string} output What clasp printed.
 * @return {{scriptId: string, sheetUrl: string}} The Script ID and the
 *     address of the sheet.
 * @throws {Error} When clasp printed no Script ID.
 */
function createdProject(output) {
  const text = output || '';
  let created = {};
  try {
    created = JSON.parse(
      text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    );
  } catch (_) {
    /* reported below */
  }
  if (!ID_PATTERN.test(created.scriptId || '')) {
    throw new Error(
      'clasp did not report a Script ID. Its output was:\n' +
        (text || '(empty)')
    );
  }
  return {
    scriptId: created.scriptId,
    sheetUrl:
      'https://docs.google.com/spreadsheets/d/' + created.parentId + '/edit'
  };
}

module.exports = { ID_PATTERN, createdProject, deploymentId };
