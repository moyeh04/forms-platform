/**
 * Stored responses: reading and writing rows, edit keys, duplicate and
 * capacity rules, Drive link checks, and notification emails.
 */

var SUBMISSION_STATUSES = ['new', 'in_review', 'approved', 'rejected', 'done'];
var REF_PREFIX_ = { team_registration: 'TR', task_submission: 'TK', reservation: 'RS', whatsapp_registration: 'WA' };

function responsesSheet(form) {
  var ss = SpreadsheetApp.openById(form.sheetId);
  return ss.getSheetByName('Responses');
}

function rowToResponse_(r) {
  return {
    _row: r._row,
    id: String(r.id), ref: String(r.ref), created: String(r.created), updated: String(r.updated),
    status: String(r.status || 'new'), review: parseJson(r.review, {}),
    email: String(r.email), name: String(r.name), code: String(r.code), phone: String(r.phone),
    title: String(r.title), link: String(r.link), slot: String(r.slot), members: String(r.members),
    data: parseJson(r.data, {}), keyHash: String(r.keyHash), keyExpires: String(r.keyExpires),
    deleted: String(r.deleted) === '1'
  };
}

function readResponses(form, includeDeleted) {
  var rows = readTable(responsesSheet(form), RESPONSE_COLS).map(rowToResponse_);
  return includeDeleted ? rows : rows.filter(function (r) { return !r.deleted; });
}

function responseToRow_(r) {
  var o = clone(r);
  o.review = JSON.stringify(r.review || {});
  o.data = JSON.stringify(r.data || {});
  o.deleted = r.deleted ? '1' : '';
  return o;
}

function saveResponse_(form, r) {
  r.updated = nowIso();
  var sh = responsesSheet(form);
  if (r._row) writeRow(sh, r._row, RESPONSE_COLS, responseToRow_(r));
  else {
    sh.appendRow(rowValues(RESPONSE_COLS, responseToRow_(r)));
    r._row = sh.getLastRow();
  }
  return r;
}

/** Fills the readable columns from the validated data. */
function applyDerived_(form, r) {
  var d = r.data;
  var slotField = Rules.fieldByRole(form, 'slot');
  r.email = Rules.valueByRole(form, d, 'email') || '';
  r.name = Rules.valueByRole(form, d, 'name') || '';
  r.code = Rules.valueByRole(form, d, 'code') || '';
  r.phone = Rules.valueByRole(form, d, 'phone') || '';
  r.title = Rules.valueByRole(form, d, 'title') || '';
  r.link = Rules.valueByRole(form, d, 'link') || '';
  r.slot = slotField && d[slotField.id] ? Rules.slotKey(d[slotField.id].day, d[slotField.id].time) : '';
  r.members = Rules.membersOf(form, d).slice(1).map(function (m) { return m.name + ' (' + m.code + ')'; }).join('; ');
  return r;
}

function nextRef_(form) {
  var count = Math.max(0, responsesSheet(form).getLastRow() - 1);
  var year = new Date().getUTCFullYear();
  return (REF_PREFIX_[form.type] || 'FM') + '-' + year + '-' + ('000' + (count + 1)).slice(-4);
}

function defaultReview_(form) {
  var out = {};
  ((form.review && form.review.steps) || []).forEach(function (s) { out[s.id] = 'pending'; });
  return out;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { fail('busy', 'The server is busy. Try again in a moment.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

function assertAcceptingSubmissions_(form) {
  var state = Rules.formState(form);
  if (state !== 'open') fail('form_' + state, 'This form is not accepting submissions.', { state: state });
}

/* ── Edit keys ────────────────────────────────────────────────── */

function keyHash_(form, key) {
  return sha256Hex(pepper() + ':key:' + form.id + ':' + key);
}

function issueKey_(form, rows) {
  var used = {};
  rows.forEach(function (r) { if (!r.deleted && r.keyHash) used[r.keyHash] = true; });
  for (var i = 0; i < 60; i++) {
    var key = randomDigits(5);
    var h = keyHash_(form, key);
    if (!used[h]) return { key: key, hash: h };
  }
  fail('keys_exhausted', 'No free edit keys are left for this form.');
}

function keyExpiry_(form) {
  var days = (form.editKey && form.editKey.days) || 7;
  return new Date(Date.now() + days * 86400000).toISOString();
}

function requireKeyEnabled_(form) {
  if (!form.editKey || !form.editKey.enabled) fail('key_disabled', 'Editing with a key is turned off for this form.');
}

/** Finds the registration a key belongs to. Wrong guesses are throttled. */
function findByKey_(form, key) {
  requireKeyEnabled_(form);
  var cache = CacheService.getScriptCache();
  var tag = 'badkey:' + form.id;
  var fails = parseInt(cache.get(tag) || '0', 10);
  if (fails >= 10) fail('too_many_attempts', 'Too many wrong keys. Wait a minute and try again.');
  key = String(key || '').trim();
  var h = /^\d{5}$/.test(key) ? keyHash_(form, key) : '';
  var hit = null;
  readResponses(form).forEach(function (r) { if (h && r.keyHash === h) hit = r; });
  if (!hit) {
    cache.put(tag, String(fails + 1), 60);
    fail('bad_key', 'That key is not right.');
  }
  if (hit.keyExpires && Date.parse(hit.keyExpires) < Date.now()) fail('key_expired', 'This key has expired. Ask your instructor to make the change.');
  return hit;
}

/* ── Rules that need the other rows ───────────────────────────── */

function checkLimits_(form, data, rows, selfId) {
  var others = rows.filter(function (r) { return r.id !== selfId; });
  var rules = form.rules || {};

  if (rules.maxSubmissions && !selfId && others.length >= rules.maxSubmissions) {
    fail('form_full', 'This form is full.');
  }

  if (rules.uniqueBy && data[rules.uniqueBy]) {
    others.forEach(function (r) {
      if (String(r.data[rules.uniqueBy]) === String(data[rules.uniqueBy])) {
        fail('duplicate', 'This code is already registered. Use your key to edit it.', { field: rules.uniqueBy });
      }
    });
  }

  if (rules.uniqueAcrossForm) {
    var mine = {};
    Rules.membersOf(form, data).forEach(function (m) { if (m.code) mine[m.code] = true; });
    var clash = [];
    others.forEach(function (r) {
      Rules.membersOf(form, r.data).forEach(function (m) { if (m.code && mine[m.code]) clash.push(m.code); });
    });
    if (clash.length) fail('duplicate_member', 'Someone on this team is already registered in another team.', { codes: clash });
  }

  var slotField = Rules.fieldByRole(form, 'slot');
  if (slotField && data[slotField.id]) {
    var key = Rules.slotKey(data[slotField.id].day, data[slotField.id].time);
    var capacity = (form.slots && form.slots.capacity) || 1;
    var used = others.filter(function (r) { return r.slot === key; }).length;
    if (used >= capacity) fail('slot_taken', 'That slot was just taken. Pick another.', { slot: key });
  }
}

/* ── Drive links ──────────────────────────────────────────────── */

function checkDriveLink_(link) {
  var p = Rules.parseDriveLink(link);
  if (!p.ok) return { ok: false, error: 'invalid_link' };
  var item;
  try {
    item = p.kind === 'folder' ? DriveApp.getFolderById(p.id) : DriveApp.getFileById(p.id);
  } catch (e) {
    return { ok: false, error: 'link_unreachable' };
  }
  var access = null;
  try { access = String(item.getSharingAccess()); } catch (e) { access = null; }
  if (access && access !== 'ANYONE' && access !== 'ANYONE_WITH_LINK') return { ok: false, error: 'link_not_public' };
  return { ok: true };
}

function checkDriveFields_(form, data) {
  if (form.rules && form.rules.driveCheck === 'off') return;
  var errors = {};
  form.fields.forEach(function (f) {
    if (f.type !== 'drive_link' || f.enabled === false || !data[f.id]) return;
    var r = checkDriveLink_(data[f.id]);
    if (!r.ok) errors[f.id] = { error: r.error };
  });
  if (Object.keys(errors).length) fail('invalid', 'Check the Google Drive links.', errors);
}

/* ── Notifications ────────────────────────────────────────────── */

function siteLink_(form) {
  var base = getProp('SITE_URL');
  return base ? base.replace(/\/+$/, '') + '/?f=' + form.slug : '';
}

function sendConfirmation_(form, result, data) {
  try {
    var to = Rules.valueByRole(form, data, 'email');
    var n = form.notifications || {};
    if (n.confirmEmail && to && result.key) {
      var lines = [
        'Your registration was received.',
        '',
        'Form: ' + form.title + (form.term ? ' (' + form.term + ')' : ''),
        'Reference: ' + result.ref
      ];
      if (form.editKey && form.editKey.enabled) {
        lines.push('Edit key: ' + result.key, 'The key works until ' + result.keyExpires.slice(0, 10) + '.');
        var link = siteLink_(form);
        if (link) lines.push('Edit or delete here: ' + link);
      }
      lines.push('', 'تم استلام تسجيلك. احتفظ بالرقم المرجعي والمفتاح.');
      MailApp.sendEmail({ to: to, subject: '[' + form.title + '] Registration received - ' + result.ref, body: lines.join('\n') });
    }
    if (n.alertEmail) {
      MailApp.sendEmail({ to: n.alertEmail, subject: '[' + form.title + '] New submission ' + result.ref, body: 'A new submission arrived: ' + result.ref });
    }
  } catch (e) {
    Logger.log('Email not sent: ' + e.message);
  }
}

/** Views are rebuilt by a later module when it is present. */
function afterChange_(form) {
  if (typeof refreshViews === 'function') {
    try { refreshViews(form); } catch (e) { Logger.log('View refresh failed: ' + e.message); }
  }
}
