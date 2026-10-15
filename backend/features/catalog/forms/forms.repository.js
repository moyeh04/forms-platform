/** The Forms tab: reading, finding and saving form rows. */

var FORM_COLS = [
  'id',
  'slug',
  'type',
  'title',
  'term',
  'status',
  'opensAt',
  'closesAt',
  'sheetId',
  'sheetUrl',
  'config',
  'createdAt',
  'updatedAt'
];

var FORM_BASE_ = [
  'id',
  'slug',
  'type',
  'title',
  'term',
  'status',
  'opensAt',
  'closesAt',
  'sheetId',
  'sheetUrl',
  'createdAt',
  'updatedAt'
];

function formsSheet() {
  return registry().getSheetByName(TABS.forms);
}

function rowToForm_(row) {
  var form = parseJson(row.config, {});
  FORM_BASE_.forEach(function (k) {
    form[k] = row[k] === undefined ? '' : String(row[k]);
  });
  Object.assign(form, FormMetadata.read(form));
  normalizeReservationMembers_(form);
  return form;
}

function formToRow_(form) {
  var config = clone(form);
  FORM_BASE_.forEach(function (k) {
    delete config[k];
  });
  var row = {};
  FORM_BASE_.forEach(function (k) {
    row[k] = form[k];
  });
  row.config = JSON.stringify(config);
  return row;
}

function readForms() {
  return readTable(formsSheet(), FORM_COLS).map(rowToForm_);
}

function findForm(slugOrId) {
  var all = readForms();
  for (var i = 0; i < all.length; i++)
    if (all[i].slug === slugOrId || all[i].id === slugOrId) return all[i];
  return null;
}

function requireForm(slugOrId) {
  var f = findForm(slugOrId);
  if (!f) ApiError.fail('form_not_found', 'That form does not exist.');
  return f;
}

/** The row a form is on now. Rows move up when a form above is deleted, so it is looked up for each write. */
function formRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++)
    if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

/** Writes a form to its row, or to a new row when it has none. Call it inside withLock_. */
function saveForm(form) {
  form.updatedAt = nowIso();
  var sh = formsSheet();
  var at = formRow_(sh, form.id);
  if (at) writeRow(sh, at, FORM_COLS, formToRow_(form));
  else appendPlain_(sh, rowValues(FORM_COLS, formToRow_(form)));
  return form;
}
