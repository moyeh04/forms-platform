/** Reads what clasp prints when it creates a project or a deployment. */

/** clasp prints "Deployed <id> @<version>"; the ID is the only long token before the version. */
function deploymentId(output) {
  const match = /([A-Za-z0-9_-]{20,})\s+@\d+/.exec(output || '');
  if (!match)
    throw new Error(
      'clasp did not report a deployment ID. Its output was:\n' +
        (output || '(empty)')
    );
  return match[1];
}

/** `clasp create --json` prints one object; anything around it is progress text. */
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
  if (!/^[A-Za-z0-9_-]+$/.test(created.scriptId || '')) {
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

module.exports = { createdProject, deploymentId };
