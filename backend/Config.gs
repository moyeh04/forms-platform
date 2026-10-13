/**
 * Constants and small helpers shared by every backend module.
 * Modules attach their handlers to the single API table below.
 */
var API = API || {};

var APP = { name: 'Forms Platform', version: '1.0.0' };

var TABS = { forms: 'Forms', clients: 'Clients', lists: 'Lists' };

var FORM_COLS = ['id', 'slug', 'type', 'title', 'term', 'status', 'opensAt', 'closesAt', 'sheetId', 'sheetUrl', 'config', 'createdAt', 'updatedAt'];

var RESPONSE_COLS = ['id', 'ref', 'created', 'updated', 'status', 'review', 'email', 'name', 'code', 'phone', 'title', 'link', 'slot', 'members', 'data', 'keyHash', 'keyExpires', 'deleted', 'keySeal', 'number'];

var CLIENT_COLS_ = ['id', 'name', 'tokenHash', 'forms', 'hiddenColumns', 'canReview', 'active', 'createdAt', 'keyHash', 'keySeal', 'expires'];

var FORM_TYPES = ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'];
var FORM_STATUSES = ['draft', 'open', 'closed', 'archived'];

/* ── Errors and responses ─────────────────────────────────────── */

function ApiError(code, message, details) {
  var e = new Error(message);
  e.isApiError = true;
  e.code = code;
  e.details = details;
  return e;
}

function fail(code, message, details) {
  throw ApiError(code, message, details);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── Small utilities ──────────────────────────────────────────── */

function clone(o) {
  return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return Utilities.getUuid();
}

function shortId(prefix) {
  return prefix + uuid().replace(/-/g, '').slice(0, 8);
}

function sha256Hex(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s));
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function randomDigits(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function slugify(s) {
  var out = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'form';
}

function getProp(k) {
  return PropertiesService.getScriptProperties().getProperty(k);
}

function setProp(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, v);
}

/** A private random value that salts every stored hash. Created once. */
function pepper() {
  var p = getProp('PEPPER');
  if (!p) {
    p = uuid() + uuid();
    setProp('PEPPER', p);
  }
  return p;
}

function parseJson(text, fallback) {
  if (text === '' || text === null || text === undefined) return fallback;
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

/* ── The script lock ──────────────────────────────────────────── */

var LOCK_DEPTH_ = 0;

/**
 * Runs `fn` while this request alone may write. Everything that reads a row and writes it back
 * does both inside, so the row cannot move or change in between. A call made inside another
 * shares its lock.
 */
function withLock_(fn) {
  if (LOCK_DEPTH_) return fn();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { fail('busy', 'The server is busy. Try again in a moment.'); }
  LOCK_DEPTH_++;
  try { return fn(); } finally { LOCK_DEPTH_--; lock.releaseLock(); }
}

/* ── Sheet table helpers ──────────────────────────────────────── */

function readTable(sheet, cols) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, cols.length).getValues();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c] = r[j]; });
    return o;
  });
}

function rowValues(cols, obj) {
  return cols.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
}

function writeRow(sheet, rowIndex, cols, obj) {
  sheet.getRange(rowIndex, 1, 1, cols.length).setValues([rowValues(cols, obj)]);
}

/**
 * Adds a row at the end as plain text and returns its number. A row past the ones a sheet was
 * made with has no format, and Sheets would turn "01012345678" into a number there. Call it
 * inside withLock_.
 */
function appendPlain_(sheet, values) {
  var at = sheet.getLastRow() + 1;
  if (at > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 50);
  sheet.getRange(at, 1, 1, values.length).setNumberFormat('@').setValues([values]);
  return at;
}

/** Writes the header of every column a data tab is missing: a tab made before a column was added gets it here. */
function ensureHeaders_(sheet, cols) {
  var have = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  cols.forEach(function (name, i) {
    if (String(have[i]) !== name) sheet.getRange(1, i + 1).setValue(name).setFontWeight('bold');
  });
}

/** Creates a tab with a bold header, frozen first row and plain-text cells. */
function ensureTab(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  sh.setFrozenRows(1);
  return sh;
}
