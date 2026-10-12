/**
 * Read-only access for instructors and clients through private links.
 * A link contains a random token; only its salted hash is stored, so a
 * leaked spreadsheet cannot be used to open anyone's view.
 *
 * A link can also need an access key: six digits the admin sends apart from the link, so a
 * link that is forwarded or leaked opens nothing on its own. Only the salted hash of the key
 * is stored, with a sealed copy only this script can open so the admin can look a lost key
 * up. Wrong keys lock the link for a while. A link made before keys existed has none and opens
 * as before.
 *
 * A link can end on a date (`expires`); after it, the link and its key open nothing until the
 * admin moves the date.
 *
 * A link names its forms by id, so renaming a form's link name does not take the form away
 * from it. Links saved with link names are read as ids and stored as ids on their next save.
 */

var CLIENT_KEY_TRIES_ = 5;

var API = API || {};

function clientsSheet_() {
  return registry().getSheetByName(TABS.clients);
}

function rowToClient_(r) {
  return {
    _row: r._row, id: String(r.id), name: String(r.name), tokenHash: String(r.tokenHash),
    forms: parseJson(r.forms, []), hiddenColumns: parseJson(r.hiddenColumns, []),
    canReview: String(r.canReview) === '1', active: String(r.active) !== '0', createdAt: String(r.createdAt),
    keyHash: String(r.keyHash || ''), keySeal: String(r.keySeal || ''), expires: String(r.expires || '')
  };
}

function readClients_() {
  var clients = readTable(clientsSheet_(), CLIENT_COLS_).map(rowToClient_);
  // A form id holds an underscore and a link name never does, so the two cannot be confused.
  var named = function (s) { return s !== '*' && String(s).indexOf('_') === -1; };
  if (!clients.some(function (c) { return c.forms.some(named); })) return clients;
  var ids = {};
  readForms().forEach(function (f) { ids[f.slug] = f.id; });
  clients.forEach(function (c) {
    if (!c.forms.some(named)) return;
    c.byName = true;
    c.forms = c.forms.map(function (s) { return named(s) ? ids[s] : s; }).filter(Boolean);
  });
  return clients;
}

/** Stores ids in every link that still names its forms by link name. Run before a link name changes. */
function keepClientForms_() {
  readClients_().forEach(function (c) { if (c.byName) saveClient_(c); });
}

/** Changes one link inside the lock, on a fresh copy of its row, and saves it. Returns what `change` returns. */
function changeClient_(id, change) {
  return withLock_(function () {
    var c = readClients_().filter(function (x) { return x.id === id; })[0];
    if (!c) fail('client_not_found', 'That client does not exist.');
    var out = change(c);
    saveClient_(c);
    return out;
  });
}

function clientToRow_(c) {
  return {
    id: c.id, name: c.name, tokenHash: c.tokenHash, forms: JSON.stringify(c.forms), hiddenColumns: JSON.stringify(c.hiddenColumns),
    canReview: c.canReview ? '1' : '0', active: c.active ? '1' : '0', createdAt: c.createdAt, keyHash: c.keyHash || '',
    keySeal: c.keySeal || '', expires: c.expires || ''
  };
}

/** Writes a link to its row, or to a new row. Call it inside withLock_, with a row read there. */
function saveClient_(c) {
  var sh = clientsSheet_();
  // A Clients tab made before the key and end-date columns gets their headers the first time a link is saved.
  CLIENT_COLS_.slice(8).forEach(function (name, i) {
    var head = sh.getRange(1, 9 + i);
    if (String(head.getValue()) !== name) head.setValue(name).setFontWeight('bold');
  });
  if (c._row) writeRow(sh, c._row, CLIENT_COLS_, clientToRow_(c));
  else {
    sh.appendRow(rowValues(CLIENT_COLS_, clientToRow_(c)));
    c._row = sh.getLastRow();
  }
  return c;
}

function clientToken_(token) {
  return sha256Hex(pepper() + ':client:' + token);
}

function clientKeyHash_(c, key) {
  return sha256Hex(pepper() + ':clientkey:' + c.id + ':' + key);
}

function clientKeyPad_(c) {
  return sha256Hex(pepper() + ':clientseal:' + c.id);
}

/** Gives the link `key`, or no key when it is empty. */
function setClientKey_(c, key) {
  c.keyHash = key ? clientKeyHash_(c, key) : '';
  c.keySeal = key ? sealDigits_(clientKeyPad_(c), key) : '';
}

function clientExpired_(c) {
  return !!(c.expires && Date.parse(c.expires) < Date.now());
}

/** An end date from the admin: an ISO time, or empty for no end. */
function cleanExpiry_(value) {
  var v = String(value || '').trim();
  if (!v) return '';
  var t = Date.parse(v);
  if (isNaN(t)) fail('bad_date', 'That end date is not a date.');
  return new Date(t).toISOString();
}

function newClientKey_() {
  var n = parseInt(uuid().replace(/-/g, '').slice(0, 10), 16) % 1000000;
  return ('00000' + n).slice(-6);
}

function newToken_() {
  return (uuid() + uuid()).replace(/-/g, '').slice(0, 24);
}

function publicClient_(c) {
  return { id: c.id, name: c.name, forms: c.forms, hiddenColumns: c.hiddenColumns, canReview: c.canReview, active: c.active, createdAt: c.createdAt,
    hasKey: !!c.keyHash, keyKnown: !!(c.keyHash && c.keySeal), expires: c.expires, expired: clientExpired_(c) };
}

function cleanClientForms_(list) {
  list = Array.isArray(list) ? list : [];
  if (list.indexOf('*') !== -1) return ['*'];
  return list.map(function (s) {
    var f = findForm(String(s));
    if (!f) fail('form_not_found', 'Form "' + s + '" does not exist.');
    return f.id;
  });
}

/** Resolves a token to an active client, or fails. */
function requireClient_(req) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('bad_tokens') || '0', 10);
  if (fails >= 30) fail('too_many_attempts', 'Too many tries. Wait a minute and open the link again.');
  var token = String((req && req.token) || '');
  var h = token ? clientToken_(token) : '';
  var hit = null;
  readClients_().forEach(function (c) { if (h && c.tokenHash === h) hit = c; });
  if (!hit) {
    cache.put('bad_tokens', String(fails + 1), 60);
    fail('bad_token', 'This link is not valid.');
  }
  if (!hit.active) fail('revoked', 'This link was turned off.');
  if (clientExpired_(hit)) fail('link_expired', 'This link ended on ' + hit.expires.slice(0, 10) + '. Ask whoever sent it to extend it.');
  if (hit.keyHash) {
    var tag = 'client_key:' + hit.id;
    var wrong = parseInt(cache.get(tag) || '0', 10);
    if (wrong >= CLIENT_KEY_TRIES_) fail('key_locked', 'Too many wrong keys. Wait ten minutes and try again.');
    var key = String((req && req.accessKey) || '').replace(/\D/g, '');
    if (!key) fail('key_needed', 'This link needs its access key.');
    if (clientKeyHash_(hit, key) !== hit.keyHash) {
      cache.put(tag, String(wrong + 1), 600);
      fail('bad_access_key', 'That access key is not right.');
    }
  }
  return hit;
}

function clientAllows_(client, form) {
  return client.forms.indexOf('*') !== -1 || client.forms.indexOf(form.id) !== -1;
}

API['admin.clients.list'] = admin(function () {
  return { clients: readClients_().map(publicClient_) };
});

API['admin.clients.create'] = admin(function (req) {
  var name = String(req.name || '').trim();
  if (!name) fail('name_required', 'Give this person or group a name.');
  var token = newToken_();
  var c = {
    id: shortId('c_'), name: name, tokenHash: clientToken_(token), forms: cleanClientForms_(req.forms),
    hiddenColumns: Array.isArray(req.hiddenColumns) ? req.hiddenColumns : [], canReview: !!req.canReview, active: true, createdAt: nowIso(),
    expires: cleanExpiry_(req.expires)
  };
  var key = req.withKey === false ? '' : newClientKey_();
  setClientKey_(c, key);
  withLock_(function () { saveClient_(c); });
  return { client: publicClient_(c), token: token, accessKey: key };
});

API['admin.clients.update'] = admin(function (req) {
  var p = req.patch || {};
  return changeClient_(req.id, function (c) {
    if (p.name !== undefined) c.name = String(p.name).trim() || c.name;
    if (p.forms !== undefined) c.forms = cleanClientForms_(p.forms);
    if (p.hiddenColumns !== undefined) c.hiddenColumns = Array.isArray(p.hiddenColumns) ? p.hiddenColumns : [];
    if (p.canReview !== undefined) c.canReview = !!p.canReview;
    if (p.active !== undefined) c.active = !!p.active;
    if (p.expires !== undefined) c.expires = cleanExpiry_(p.expires);
    return { client: publicClient_(c) };
  });
});

API['admin.clients.regenerate'] = admin(function (req) {
  var token = newToken_();
  return changeClient_(req.id, function (c) {
    c.tokenHash = clientToken_(token);
    c.active = true;
    return { client: publicClient_(c), token: token };
  });
});

/** Gives a link a new access key (`on`), or removes its key so the link alone opens it. */
API['admin.clients.key'] = admin(function (req) {
  var key = req.on === false ? '' : newClientKey_();
  return changeClient_(req.id, function (c) {
    setClientKey_(c, key);
    CacheService.getScriptCache().remove('client_key:' + c.id);
    return { client: publicClient_(c), accessKey: key };
  });
});

/** The admin reads a link's current key, for example when the client lost it. */
API['admin.clients.showKey'] = admin(function (req) {
  var c = readClients_().filter(function (x) { return x.id === req.id; })[0];
  if (!c) fail('client_not_found', 'That client does not exist.');
  if (!c.keyHash) fail('no_key', 'This link does not ask for a key.');
  var key = unsealDigits_(clientKeyPad_(c), c.keySeal, 6);
  if (!key || clientKeyHash_(c, key) !== c.keyHash) fail('key_unknown', 'This key was made before keys could be shown. Make a new key to see it.');
  return { accessKey: key };
});

API['admin.clients.remove'] = admin(function (req) {
  return withLock_(function () {
    var c = readClients_().filter(function (x) { return x.id === req.id; })[0];
    if (!c) fail('client_not_found', 'That client does not exist.');
    clientsSheet_().deleteRow(c._row);
    return { removed: true };
  });
});
