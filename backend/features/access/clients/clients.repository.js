/** The Clients tab: the private links of instructors and clients. */

var CLIENT_COLS_ = [
  'id',
  'name',
  'tokenHash',
  'forms',
  'hiddenColumns',
  'canReview',
  'active',
  'createdAt',
  'keyHash',
  'keySeal',
  'expires',
  'showSizeAlerts'
];

function clientsSheet_() {
  return registry().getSheetByName(TABS.clients);
}

function rowToClient_(r) {
  return {
    _row: r._row,
    id: String(r.id),
    name: String(r.name),
    tokenHash: String(r.tokenHash),
    forms: parseJson(r.forms, []),
    hiddenColumns: parseJson(r.hiddenColumns, []),
    canReview: String(r.canReview) === '1',
    active: String(r.active) !== '0',
    createdAt: String(r.createdAt),
    keyHash: String(r.keyHash || ''),
    keySeal: String(r.keySeal || ''),
    expires: String(r.expires || ''),
    showSizeAlerts: String(r.showSizeAlerts) !== '0'
  };
}

function readClients_() {
  var clients = readTable(clientsSheet_(), CLIENT_COLS_).map(rowToClient_);
  // A form id holds an underscore and a link name never does, so the two cannot be confused.
  var named = function (s) {
    return s !== '*' && String(s).indexOf('_') === -1;
  };
  if (
    !clients.some(function (c) {
      return c.forms.some(named);
    })
  )
    return clients;
  var ids = {};
  readForms().forEach(function (f) {
    ids[f.slug] = f.id;
  });
  clients.forEach(function (c) {
    if (!c.forms.some(named)) return;
    c.byName = true;
    c.forms = c.forms
      .map(function (s) {
        return named(s) ? ids[s] : s;
      })
      .filter(Boolean);
  });
  return clients;
}

/** Stores ids in every link that still names its forms by link name. Run before a link name changes. */
function keepClientForms_() {
  readClients_().forEach(function (c) {
    if (c.byName) saveClient_(c);
  });
}

/** Changes one link inside the lock, on a fresh copy of its row, and saves it. Returns what `change` returns. */
function changeClient_(id, change) {
  return withLock_(function () {
    var c = readClients_().filter(function (x) {
      return x.id === id;
    })[0];
    if (!c) fail('client_not_found', 'That client does not exist.');
    var out = change(c);
    saveClient_(c);
    return out;
  });
}

function clientToRow_(c) {
  return {
    id: c.id,
    name: c.name,
    tokenHash: c.tokenHash,
    forms: JSON.stringify(c.forms),
    hiddenColumns: JSON.stringify(c.hiddenColumns),
    canReview: c.canReview ? '1' : '0',
    active: c.active ? '1' : '0',
    createdAt: c.createdAt,
    keyHash: c.keyHash || '',
    keySeal: c.keySeal || '',
    expires: c.expires || '',
    showSizeAlerts: c.showSizeAlerts === false ? '0' : '1'
  };
}

/** Writes a link to its row, or to a new row. Call it inside withLock_, with a row read there. */
function saveClient_(c) {
  var sh = clientsSheet_();
  ensureHeaders_(sh, CLIENT_COLS_);
  if (c._row) writeRow(sh, c._row, CLIENT_COLS_, clientToRow_(c));
  else c._row = appendPlain_(sh, rowValues(CLIENT_COLS_, clientToRow_(c)));
  return c;
}
