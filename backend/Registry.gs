/**
 * The registry spreadsheet: one row per form, plus shared lists and clients.
 * Each form also owns a separate spreadsheet for its responses.
 */

function registry() {
  var id = getProp('REGISTRY_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function rootFolder() {
  var id = getProp('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ }
  }
  var f = DriveApp.createFolder('Forms Platform');
  setProp('ROOT_FOLDER_ID', f.getId());
  return f;
}

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
      lists.appendRow([k, JSON.stringify(normalizeListValues(DEFAULT_LISTS[k]))]);
    });
  }
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  rootFolder();
  installTriggers_();
  return { registryUrl: ss.getUrl(), folderId: getProp('ROOT_FOLDER_ID') };
}

function installTriggers_() {
  var have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processDirtyViews'; });
  if (!have) ScriptApp.newTrigger('processDirtyViews').timeBased().everyMinutes(5).create();
}

/* ── Lists ────────────────────────────────────────────────────── */

function readLists() {
  var sh = registry().getSheetByName(TABS.lists);
  var out = {};
  if (!sh) return out;
  readTable(sh, ['key', 'values']).forEach(function (r) { out[r.key] = parseJson(r.values, []); });
  return out;
}

function saveList(key, values) {
  var sh = registry().getSheetByName(TABS.lists);
  var rows = readTable(sh, ['key', 'values']);
  var json = JSON.stringify(normalizeListValues(values));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) {
      writeRow(sh, rows[i]._row, ['key', 'values'], { key: key, values: json });
      return;
    }
  }
  sh.appendRow([key, json]);
}

/* ── Forms ────────────────────────────────────────────────────── */

var FORM_BASE_ = ['id', 'slug', 'type', 'title', 'term', 'status', 'opensAt', 'closesAt', 'sheetId', 'sheetUrl', 'createdAt', 'updatedAt'];

function formsSheet() {
  return registry().getSheetByName(TABS.forms);
}

function rowToForm_(row) {
  var form = parseJson(row.config, {});
  FORM_BASE_.forEach(function (k) { form[k] = row[k] === undefined ? '' : String(row[k]); });
  form._row = row._row;
  return form;
}

function formToRow_(form) {
  var config = clone(form);
  FORM_BASE_.concat(['_row']).forEach(function (k) { delete config[k]; });
  var row = {};
  FORM_BASE_.forEach(function (k) { row[k] = form[k]; });
  row.config = JSON.stringify(config);
  return row;
}

function readForms() {
  return readTable(formsSheet(), FORM_COLS).map(rowToForm_);
}

function findForm(slugOrId) {
  var all = readForms();
  for (var i = 0; i < all.length; i++) if (all[i].slug === slugOrId || all[i].id === slugOrId) return all[i];
  return null;
}

function requireForm(slugOrId) {
  var f = findForm(slugOrId);
  if (!f) fail('form_not_found', 'That form does not exist.');
  return f;
}

function saveForm(form) {
  form.updatedAt = nowIso();
  var sh = formsSheet();
  var row = formToRow_(form);
  if (form._row) {
    writeRow(sh, form._row, FORM_COLS, row);
  } else {
    sh.appendRow(rowValues(FORM_COLS, row));
    form._row = sh.getLastRow();
  }
  return form;
}

function uniqueSlug_(wanted) {
  var taken = {};
  readForms().forEach(function (f) { taken[f.slug] = true; });
  var base = slugify(wanted), slug = base, n = 2;
  while (taken[slug]) slug = base + '-' + n++;
  return slug;
}

/** Creates the form's own spreadsheet inside the platform folder. */
function attachSheet_(form) {
  var ss = SpreadsheetApp.create(form.title + (form.term ? ' - ' + form.term : ''));
  var first = ss.getSheets()[0];
  first.setName('Responses');
  first.getRange(1, 1, 1, RESPONSE_COLS.length).setValues([RESPONSE_COLS]).setFontWeight('bold');
  first.getRange(1, 1, first.getMaxRows(), RESPONSE_COLS.length).setNumberFormat('@');
  first.setFrozenRows(1);
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder());
  form.sheetId = ss.getId();
  form.sheetUrl = ss.getUrl();
}

function createForm(o) {
  if (FORM_TYPES.indexOf(o.type) === -1) fail('unknown_type', 'Unknown form type.');
  var title = String(o.title || '').trim();
  if (!title) fail('title_required', 'Give the form a title.');
  var form = templateFor(o.type);
  form.type = o.type;
  form.title = title;
  form.term = String(o.term || '').trim();
  form.slug = uniqueSlug_(o.slug || (title + ' ' + form.term));
  form.id = shortId('f_');
  form.status = 'draft';
  form.opensAt = '';
  form.closesAt = '';
  form.createdAt = nowIso();
  attachSheet_(form);
  return saveForm(form);
}

/** Merges new rule settings over the old ones and checks the team size range. */
function normalizeRules_(current, next) {
  var merged = Object.assign({}, current || {}, next || {});
  if (merged.teamSize !== undefined) {
    var min = parseInt(merged.teamSize && merged.teamSize.min, 10);
    var max = parseInt(merged.teamSize && merged.teamSize.max, 10);
    if (!(min >= 1) || !(max >= min) || max > 20) {
      fail('bad_team_size', 'Team size must be between 1 and 20, and the maximum cannot be lower than the minimum.');
    }
    merged.teamSize = { min: min, max: max };
  }
  return merged;
}

var PATCHABLE_ = ['title', 'term', 'slug', 'status', 'opensAt', 'closesAt', 'lang', 'icon', 'steps', 'fields', 'slots', 'rules', 'review', 'matching', 'editKey', 'notifications', 'messages'];

function updateForm(id, patch) {
  var form = requireForm(id);
  PATCHABLE_.forEach(function (k) {
    if (patch[k] === undefined) return;
    if (k === 'status' && FORM_STATUSES.indexOf(patch[k]) === -1) fail('bad_status', 'Status must be draft, open, closed, or archived.');
    if (k === 'rules') {
      form.rules = normalizeRules_(form.rules, patch.rules);
      return;
    }
    if (k === 'slots') {
      form.slots = normalizeSlots_(patch.slots);
      return;
    }
    if (k === 'slug') {
      var wanted = slugify(patch.slug);
      var clash = findForm(wanted);
      if (clash && clash.id !== form.id) fail('slug_taken', 'Another form already uses that link name.');
      form.slug = wanted;
      return;
    }
    form[k] = patch[k];
  });
  return saveForm(form);
}

function duplicateForm(id, o) {
  var src = requireForm(id);
  var copy = clone(src);
  delete copy._row;
  copy.id = shortId('f_');
  copy.title = (o && o.title) || src.title;
  copy.term = o && o.term !== undefined ? o.term : src.term;
  copy.slug = uniqueSlug_((o && o.slug) || copy.title + ' ' + copy.term);
  copy.status = 'draft';
  copy.createdAt = nowIso();
  attachSheet_(copy);
  return saveForm(copy);
}

/** Lists are merged into select fields so the browser gets plain options. */
function resolveOptions_(form, lists) {
  function fix(fields) {
    (fields || []).forEach(function (f) {
      if (f.list) f.options = lists[f.list] || [];
      if (f.fields) fix(f.fields);
    });
  }
  fix(form.fields);
  return form;
}

var PUBLIC_KEYS_ = ['slug', 'type', 'title', 'term', 'lang', 'icon', 'steps', 'fields', 'slots', 'editKey', 'messages', 'status', 'opensAt', 'closesAt'];

function publicForm(form) {
  var full = resolveOptions_(clone(form), readLists());
  var out = {};
  PUBLIC_KEYS_.forEach(function (k) { if (full[k] !== undefined) out[k] = full[k]; });
  out.editKey = { enabled: !!full.editKey.enabled, days: full.editKey.days, allowEdit: !!full.editKey.allowEdit, allowDelete: !!full.editKey.allowDelete };
  out.rules = { maxSubmissions: full.rules ? full.rules.maxSubmissions : null };
  if (full.rules && full.rules.teamSize) out.rules.teamSize = full.rules.teamSize;
  return out;
}

/** The form with options resolved, for server-side validation. */
function validationForm(form) {
  return resolveOptions_(clone(form), readLists());
}
