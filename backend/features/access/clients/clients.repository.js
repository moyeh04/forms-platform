/** The Clients tab: the private links of instructors and clients. */

var ClientsRepository = (function () {
  /** The columns of the Clients tab, in sheet order. */
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

  /**
   * Opens the Clients tab of the registry.
   *
   * @return {!SpreadsheetApp.Sheet} The tab.
   */
  function clientsSheet_() {
    return RegistryRepository.registry().getSheetByName(Constants.TABS.clients);
  }

  /**
   * Turns a row of the tab into a link.
   *
   * @param {!Object} r The row, by column name.
   * @return {!Object} The link, with its `_row`.
   */
  function rowToClient_(r) {
    return {
      _row: r._row,
      id: String(r.id),
      name: String(r.name),
      tokenHash: String(r.tokenHash),
      forms: Json.parseJson(r.forms, []),
      hiddenColumns: Json.parseJson(r.hiddenColumns, []),
      canReview: Cell.readFlag(r.canReview, false),
      active: Cell.readFlag(r.active, true),
      createdAt: String(r.createdAt),
      keyHash: String(r.keyHash || ''),
      keySeal: String(r.keySeal || ''),
      expires: String(r.expires || ''),
      showSizeAlerts: Cell.readFlag(r.showSizeAlerts, true)
    };
  }

  /**
   * Says whether a link names a form by its link name. A form id holds an
   * underscore and a link name never does, so the two cannot be confused.
   *
   * @param {*} s A form of the link.
   * @return {boolean} True for a link name.
   */
  function named(s) {
    return s !== '*' && String(s).indexOf('_') === -1;
  }

  /**
   * Reads every link. Forms named by link name are read as ids, and the link
   * is marked `byName` so its next save stores the ids.
   *
   * @return {!Array<!Object>} The links.
   */
  function readClients_() {
    var clients = Table.readTable(clientsSheet_(), CLIENT_COLS_).map(
      rowToClient_
    );
    if (
      !clients.some(function (c) {
        return c.forms.some(named);
      })
    )
      return clients;
    var ids = {};
    FormsRepository.readForms().forEach(function (f) {
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

  /**
   * Stores ids in every link that still names its forms by link name. Run
   * it before a link name changes.
   */
  function keepClientForms_() {
    readClients_().forEach(function (c) {
      if (c.byName) saveClient_(c);
    });
  }

  /**
   * Changes one link inside the lock, on a fresh copy of its row, and saves
   * it.
   *
   * @param {string} id The id of the link.
   * @param {function(!Object): *} change Changes the link in place.
   * @return {*} What `change` returns.
   * @throws {ApiError} `client_not_found` when there is no such link.
   */
  function changeClient_(id, change) {
    return Lock.withLock(function () {
      var c = readClients_().filter(function (x) {
        return x.id === id;
      })[0];
      if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
      var out = change(c);
      saveClient_(c);
      return out;
    });
  }

  /**
   * Turns a link into the values of its row.
   *
   * @param {!Object} c The link.
   * @return {!Object} The row, by column name.
   */
  function clientToRow_(c) {
    return {
      id: c.id,
      name: c.name,
      tokenHash: c.tokenHash,
      forms: JSON.stringify(c.forms),
      hiddenColumns: JSON.stringify(c.hiddenColumns),
      canReview: Cell.writeFlag(c.canReview, '0'),
      active: Cell.writeFlag(c.active, '0'),
      createdAt: c.createdAt,
      keyHash: c.keyHash || '',
      keySeal: c.keySeal || '',
      expires: c.expires || '',
      showSizeAlerts: Cell.writeFlag(c.showSizeAlerts !== false, '0')
    };
  }

  /**
   * Writes a link to its row, or to a new row. Call it inside Lock.withLock,
   * with a row read there.
   *
   * @param {!Object} c The link; a new one gets its `_row`.
   * @return {!Object} The same link.
   */
  function saveClient_(c) {
    var sh = clientsSheet_();
    Table.ensureHeaders(sh, CLIENT_COLS_);
    if (c._row) Table.writeRow(sh, c._row, CLIENT_COLS_, clientToRow_(c));
    else
      c._row = Table.appendPlain(
        sh,
        Table.rowValues(CLIENT_COLS_, clientToRow_(c))
      );
    return c;
  }

  /**
   * Deletes the row of a link. Call it inside Lock.withLock, with a row read
   * there.
   *
   * @param {!Object} c The link.
   */
  function deleteClient_(c) {
    clientsSheet_().deleteRow(c._row);
  }

  return {
    CLIENT_COLS: CLIENT_COLS_,
    deleteClient: deleteClient_,
    readClients: readClients_,
    saveClient: saveClient_,
    changeClient: changeClient_,
    keepClientForms: keepClientForms_
  };
})();
