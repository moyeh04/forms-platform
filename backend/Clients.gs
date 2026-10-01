/**
 * Read-only access for instructors and clients through private links.
 * A link contains a random token; only its salted hash is stored, so a
 * leaked spreadsheet cannot be used to open anyone's view.
 */

var API = API || {};

function clientsSheet_() {
  return registry().getSheetByName(TABS.clients);
}

function rowToClient_(r) {
  return {
    _row: r._row, id: String(r.id), name: String(r.name), tokenHash: String(r.tokenHash),
    forms: parseJson(r.forms, []), hiddenColumns: parseJson(r.hiddenColumns, []),
    canReview: String(r.canReview) === '1', active: String(r.active) !== '0', createdAt: String(r.createdAt)
  };
}

function readClients_() {
  return readTable(clientsSheet_(), CLIENT_COLS_).map(rowToClient_);
}

function clientToRow_(c) {
  return {
    id: c.id, name: c.name, tokenHash: c.tokenHash, forms: JSON.stringify(c.forms), hiddenColumns: JSON.stringify(c.hiddenColumns),
    canReview: c.canReview ? '1' : '0', active: c.active ? '1' : '0', createdAt: c.createdAt
  };
}

function saveClient_(c) {
  var sh = clientsSheet_();
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

function newToken_() {
  return (uuid() + uuid()).replace(/-/g, '').slice(0, 24);
}

function publicClient_(c) {
  return { id: c.id, name: c.name, forms: c.forms, hiddenColumns: c.hiddenColumns, canReview: c.canReview, active: c.active, createdAt: c.createdAt };
}

function cleanClientForms_(list) {
  list = Array.isArray(list) ? list : [];
  if (list.indexOf('*') !== -1) return ['*'];
  return list.map(function (s) {
    var f = findForm(String(s));
    if (!f) fail('form_not_found', 'Form "' + s + '" does not exist.');
    return f.slug;
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
  return hit;
}

function clientAllows_(client, form) {
  return client.forms.indexOf('*') !== -1 || client.forms.indexOf(form.slug) !== -1;
}

API['admin.clients.list'] = admin(function () {
  return { clients: readClients_().map(publicClient_) };
});

API['admin.clients.create'] = admin(function (req) {
  var name = String(req.name || '').trim();
  if (!name) fail('name_required', 'Give this person or group a name.');
  var token = newToken_();
  var c = saveClient_({
    id: shortId('c_'), name: name, tokenHash: clientToken_(token), forms: cleanClientForms_(req.forms),
    hiddenColumns: Array.isArray(req.hiddenColumns) ? req.hiddenColumns : [], canReview: !!req.canReview, active: true, createdAt: nowIso()
  });
  return { client: publicClient_(c), token: token };
});

API['admin.clients.update'] = admin(function (req) {
  var c = readClients_().filter(function (x) { return x.id === req.id; })[0];
  if (!c) fail('client_not_found', 'That client does not exist.');
  var p = req.patch || {};
  if (p.name !== undefined) c.name = String(p.name).trim() || c.name;
  if (p.forms !== undefined) c.forms = cleanClientForms_(p.forms);
  if (p.hiddenColumns !== undefined) c.hiddenColumns = Array.isArray(p.hiddenColumns) ? p.hiddenColumns : [];
  if (p.canReview !== undefined) c.canReview = !!p.canReview;
  if (p.active !== undefined) c.active = !!p.active;
  saveClient_(c);
  return { client: publicClient_(c) };
});

API['admin.clients.regenerate'] = admin(function (req) {
  var c = readClients_().filter(function (x) { return x.id === req.id; })[0];
  if (!c) fail('client_not_found', 'That client does not exist.');
  var token = newToken_();
  c.tokenHash = clientToken_(token);
  c.active = true;
  saveClient_(c);
  return { client: publicClient_(c), token: token };
});

API['admin.clients.remove'] = admin(function (req) {
  var c = readClients_().filter(function (x) { return x.id === req.id; })[0];
  if (!c) fail('client_not_found', 'That client does not exist.');
  clientsSheet_().deleteRow(c._row);
  return { removed: true };
});
