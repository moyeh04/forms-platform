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
  return { registryUrl: ss.getUrl(), folderId: getProp('ROOT_FOLDER_ID') };
}

/* ── Lists ────────────────────────────────────────────────────── */

/*
 * A row of the Lists tab is one list: its key and its choices as JSON. The row with the key
 * `_info` holds the name and the kind of each list an admin made, so the tab keeps its two
 * columns. A key that starts with "_" is never a list.
 */
var LIST_INFO_KEY_ = '_info';
var LIST_KINDS_ = ['sections', 'numbers', 'named', 'plain'];
/** The kind of each built-in list; a list an admin made has its kind in `_info`. */
var BUILTIN_LIST_KINDS_ = { levels: 'named', curricula: 'plain', majors: 'named', sections: 'sections', groups: 'plain', wa_sections: 'numbers' };
var BUILTIN_LIST_NAMES_ = { levels: 'Levels', curricula: 'Bylaws', majors: 'Majors', sections: 'Sections', groups: 'Groups', wa_sections: 'WhatsApp section numbers' };

function listRows_() {
  var sh = registry().getSheetByName(TABS.lists);
  return sh ? readTable(sh, ['key', 'values']) : [];
}

function readLists() {
  var out = {};
  listRows_().forEach(function (r) { if (String(r.key).charAt(0) !== '_') out[r.key] = parseJson(r.values, []); });
  return out;
}

/** { key: { name, kind } } for the lists an admin made. */
function readListInfo() {
  var row = listRows_().filter(function (r) { return r.key === LIST_INFO_KEY_; })[0];
  return row ? parseJson(row.values, {}) : {};
}

function listKind_(key, info) {
  return (info && info[key] && info[key].kind) || BUILTIN_LIST_KINDS_[key] || 'plain';
}

function writeListRow_(key, json) {
  var sh = registry().getSheetByName(TABS.lists);
  var rows = readTable(sh, ['key', 'values']);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) {
      writeRow(sh, rows[i]._row, ['key', 'values'], { key: key, values: json });
      return;
    }
  }
  sh.appendRow([key, json]);
}

function saveList(key, values) {
  writeListRow_(key, JSON.stringify(normalizeListValues(values)));
}

function saveListInfo_(info) {
  writeListRow_(LIST_INFO_KEY_, JSON.stringify(info));
}

function deleteList_(key) {
  var sh = registry().getSheetByName(TABS.lists);
  var row = readTable(sh, ['key', 'values']).filter(function (r) { return r.key === key; })[0];
  if (row) sh.deleteRow(row._row);
  var info = readListInfo();
  delete info[key];
  saveListInfo_(info);
}

/** Forms whose questions, or member questions, read the list. */
function formsUsingList_(key) {
  var uses = function (fields) { return (fields || []).some(function (f) { return f.list === key || uses(f.fields); }); };
  return readForms().filter(function (f) { return uses(f.fields); });
}

/* ── Forms ────────────────────────────────────────────────────── */

var FORM_BASE_ = ['id', 'slug', 'type', 'title', 'term', 'status', 'opensAt', 'closesAt', 'sheetId', 'sheetUrl', 'createdAt', 'updatedAt'];

function formsSheet() {
  return registry().getSheetByName(TABS.forms);
}

function rowToForm_(row) {
  var form = parseJson(row.config, {});
  FORM_BASE_.forEach(function (k) { form[k] = row[k] === undefined ? '' : String(row[k]); });
  Object.assign(form, FormMetadata.read(form));
  normalizeReservationMembers_(form);
  return form;
}

function formToRow_(form) {
  var config = clone(form);
  FORM_BASE_.forEach(function (k) { delete config[k]; });
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

/** The row a form is on now. Rows move up when a form above is deleted, so it is looked up for each write. */
function formRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

/** Writes a form to its row, or to a new row when it has none. Call it inside withLock_. */
function saveForm(form) {
  form.updatedAt = nowIso();
  var sh = formsSheet();
  var at = formRow_(sh, form.id);
  if (at) writeRow(sh, at, FORM_COLS, formToRow_(form));
  else sh.appendRow(rowValues(FORM_COLS, formToRow_(form)));
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
  var metadata = FormMetadata.sheet(form);
  var ss = SpreadsheetApp.create(form.title + (metadata ? ' - ' + metadata : ''));
  var first = ss.getSheets()[0];
  first.setName('Responses');
  first.getRange(1, 1, 1, RESPONSE_COLS.length).setValues([RESPONSE_COLS]).setFontWeight('bold');
  first.getRange(1, 1, first.getMaxRows(), RESPONSE_COLS.length).setNumberFormat('@');
  first.setFrozenRows(1);
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder());
  form.sheetId = ss.getId();
  form.sheetUrl = ss.getUrl();
}

/** A subject code such as CMPn323: letters, digits, and dashes, no spaces. */
function cleanSubject_(v) {
  return String(v || '').replace(/\s+/g, '').replace(/[^A-Za-z0-9\-]/g, '').slice(0, 20);
}

/**
 * Gives a new form its sheet and its row. The sheet is made first, outside the lock, because
 * Google takes seconds to create one; the link name is chosen and the row written inside it.
 * `adjust` may change the form before it is saved.
 */
function addForm_(form, wantedSlug, adjust) {
  form.id = shortId('f_');
  form.status = 'draft';
  form.createdAt = nowIso();
  attachSheet_(form);
  return withLock_(function () {
    form.slug = uniqueSlug_(wantedSlug || (form.title + ' ' + FormMetadata.slug(form)));
    if (adjust) adjust(form);
    return saveForm(form);
  });
}

function createForm(o, adjust) {
  if (FORM_TYPES.indexOf(o.type) === -1) fail('unknown_type', 'Unknown form type.');
  var title = String(o.title || '').trim();
  if (!title) fail('title_required', 'Give the form a title.');
  var form = templateFor(o.type);
  form.type = o.type;
  form.title = title;
  Object.assign(form, FormMetadata.create(form.type, o));
  form.opensAt = '';
  form.closesAt = '';
  return addForm_(form, o.slug, adjust);
}

/** Merges new rule settings over the old ones and checks the team size range. */
function normalizeRules_(current, next) {
  var merged = Object.assign({}, current || {}, next || {});
  LIMITED_LISTS_.forEach(function (list) {
    if (merged[list] !== undefined) merged[list] = Array.isArray(merged[list]) ? merged[list].map(String).filter(Boolean) : [];
  });
  if (merged.teamSize !== undefined) {
    var min = parseInt(merged.teamSize && merged.teamSize.min, 10);
    var max = parseInt(merged.teamSize && merged.teamSize.max, 10);
    if (!(min >= 1) || !(max >= min) || max > 20) {
      fail('bad_team_size', 'Team size must be between 1 and 20, and the maximum cannot be lower than the minimum.');
    }
    merged.teamSize = { min: min, max: max };
    var notice = next && next.teamSize && next.teamSize.notice !== undefined ? next.teamSize.notice : current && current.teamSize && current.teamSize.notice;
    if (notice) merged.teamSize.notice = normalizeSizeNotice_(notice, min, max);
  }
  return merged;
}

/** Keeps only whole sizes inside the range, and trimmed English and Arabic text. */
function normalizeSizeNotice_(n, min, max) {
  var sizes = [];
  (Array.isArray(n.sizes) ? n.sizes : []).forEach(function (x) {
    var v = parseInt(x, 10);
    if (v >= min && v <= max && sizes.indexOf(v) === -1) sizes.push(v);
  });
  sizes.sort(function (a, b) { return a - b; });
  var text = n.text || {};
  return { sizes: sizes, text: { en: String(text.en || '').trim(), ar: String(text.ar || '').trim() } };
}

var PATCHABLE_ = ['title', 'slug', 'status', 'opensAt', 'closesAt', 'lang', 'icon', 'steps', 'fields', 'slots', 'rules', 'review', 'matching', 'editKey', 'notifications', 'messages', 'keyBooking'];

/**
 * Changes a form. `base` is the `updatedAt` of the copy the page was showing: when the form
 * has been saved since, the change is refused instead of overwriting the newer one.
 */
function updateForm(id, patch, base) {
  return withLock_(function () { return applyFormPatch_(requireForm(id), patch, base); });
}

function applyFormPatch_(form, patch, base) {
  if (base && String(base) !== form.updatedAt) {
    fail('stale', 'This form was changed in another window since you opened it. Press Discard to load the latest, then make your change again.');
  }
  FormMetadata.update(form, patch);
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
    if (k === 'keyBooking') {
      form.keyBooking = normalizeKeyBooking_(form, patch.keyBooking);
      return;
    }
    if (k === 'slug') {
      var wanted = slugify(patch.slug);
      var clash = findForm(wanted);
      if (clash && clash.id !== form.id) fail('slug_taken', 'Another form already uses that link name.');
      if (wanted !== form.slug) keepClientForms_();
      form.slug = wanted;
      return;
    }
    form[k] = patch[k];
  });
  if (patch.fields !== undefined || patch.steps !== undefined) normalizeQuestions_(form);
  return saveForm(form);
}

function duplicateForm(id, o, adjust) {
  var src = requireForm(id);
  var copy = clone(src);
  copy.title = (o && o.title) || src.title;
  var metadata = FormMetadata.duplicate(src, o || {});
  FormMetadata.legacyFields(src.type).forEach(function (key) { delete copy[key]; });
  Object.assign(copy, metadata);
  return addForm_(copy, o && o.slug, adjust);
}

/**
 * Deletes a form: its registry row goes, its spreadsheet moves to the Drive
 * trash (restorable for 30 days), and private links stop listing it.
 */
function deleteForm(id) {
  return withLock_(function () { return removeForm_(requireForm(id)); });
}

function removeForm_(form) {
  var sh = formsSheet();
  sh.deleteRow(formRow_(sh, form.id));
  var trashed = false;
  if (form.sheetId) {
    try { DriveApp.getFileById(form.sheetId).setTrashed(true); trashed = true; } catch (e) { Logger.log('Sheet not trashed: ' + e.message); }
  }
  try { PropertiesService.getScriptProperties().deleteProperty('dirty:' + form.id); } catch (e) { /* nothing to clean */ }
  readClients_().forEach(function (c) {
    if (c.forms.indexOf(form.id) === -1) return;
    c.forms = c.forms.filter(function (s) { return s !== form.id; });
    saveClient_(c);
  });
  return { deleted: true, sheetTrashed: trashed, title: form.title };
}

/**
 * The rules that limit a form to some values: rules.majors for the Majors list, and
 * rules.sections for whichever list of sections the section question reads.
 */
var LIMITED_LISTS_ = ['majors', 'sections'];

/** The rule that limits the choices of a list, or '' when none does. */
function limitRuleOf_(list, info) {
  if (list === 'majors') return 'majors';
  return listKind_(list, info) === 'sections' ? 'sections' : '';
}

/** The values of a list that a form is limited to; empty means every value. */
function allowedValues_(form, list) {
  var m = form && form.rules && form.rules[list];
  return Array.isArray(m) ? m.map(String).filter(Boolean) : [];
}

/** The specializations a form is limited to; empty means everyone. */
function allowedMajors_(form) {
  return allowedValues_(form, 'majors');
}

/** Lists are merged into select fields so the browser gets plain options. */
function resolveOptions_(form, lists, info) {
  info = info || readListInfo();
  function fix(fields) {
    (fields || []).forEach(function (f) {
      if (f.list) f.options = lists[f.list] || [];
      // A form limited to some values of a list only offers (and only accepts) those.
      var rule = f.list ? limitRuleOf_(f.list, info) : '';
      var allowed = rule ? allowedValues_(form, rule) : [];
      if (allowed.length) {
        f.options = f.options.filter(function (o) { return allowed.indexOf(String(o.value)) !== -1; });
      }
      if (f.fields) fix(f.fields);
    });
  }
  fix(form.fields);
  return form;
}

var PUBLIC_KEYS_ = ['slug', 'type', 'title', 'lang', 'icon', 'steps', 'fields', 'slots', 'editKey', 'messages', 'status', 'opensAt', 'closesAt'];

function publicForm(form) {
  var full = resolveOptions_(clone(form), readLists());
  var out = {};
  PUBLIC_KEYS_.forEach(function (k) { if (full[k] !== undefined) out[k] = full[k]; });
  Object.assign(out, FormMetadata.public(full));
  out.editKey = { enabled: !!full.editKey.enabled, days: full.editKey.days, allowEdit: !!full.editKey.allowEdit, allowDelete: !!full.editKey.allowDelete };
  out.rules = { maxSubmissions: full.rules ? full.rules.maxSubmissions : null };
  if (full.rules && full.rules.teamSize) out.rules.teamSize = full.rules.teamSize;
  if (allowedMajors_(full).length) out.rules.majors = allowedMajors_(full);
  var source = keyBookingSource_(form);
  if (source) out.keyBooking = { title: source.title };
  if (full.rules && full.rules.folderName && full.rules.folderName.enabled) {
    out.rules.folderName = { enabled: true, subject: String(full.rules.folderName.subject || '') };
  }
  return out;
}

/** The form with options resolved, for server-side validation. */
function validationForm(form) {
  return resolveOptions_(clone(form), readLists());
}
