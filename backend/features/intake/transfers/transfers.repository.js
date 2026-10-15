/** The Transfers tab of a form: reading and saving move requests. */

var TransfersRepository = (function () {
  /** The columns of the Transfers tab, in order. */
  var TRANSFER_COLS = [
    'id',
    'created',
    'updated',
    'status',
    'code',
    'member',
    'fromId',
    'fromRef',
    'toId',
    'toRef',
    'decidedBy'
  ];

  /** The name of the tab of the requests. */
  var TRANSFER_TAB_ = 'Transfers';

  /**
   * Says whether a form lets a leader ask for a member of another team:
   * transfers are on, a student may be in one team only, and the form has
   * members.
   *
   * @param {!Object} form The form.
   * @return {boolean} True when transfers can happen.
   */
  function transfersOn_(form) {
    var rules = form.rules || {};
    return !!(
      rules.transfers &&
      rules.uniqueAcrossForm &&
      Rules.fieldByRole(form, 'members')
    );
  }

  /**
   * Opens the Transfers tab of a form.
   *
   * @param {!Object} form The form.
   * @param {boolean} create Whether to make the tab when it is missing.
   * @return {?SpreadsheetApp.Sheet} The tab, or null when it is missing
   *     and not made.
   */
  function transfersSheet_(form, create) {
    var ss = SpreadsheetApp.openById(form.sheetId);
    return create
      ? Table.ensureTab(ss, TRANSFER_TAB_, TRANSFER_COLS)
      : ss.getSheetByName(TRANSFER_TAB_);
  }

  /**
   * Reads every request of a form.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} The requests, each with its `_row`; empty
   *     when the form never had one.
   */
  function readTransfers_(form) {
    var sh = transfersSheet_(form, false);
    if (!sh) return [];
    return Table.readTable(sh, TRANSFER_COLS).map(function (r) {
      return {
        _row: r._row,
        id: String(r.id),
        created: String(r.created),
        updated: String(r.updated),
        status: String(r.status),
        code: String(r.code),
        member: Json.parseJson(r.member, {}),
        fromId: String(r.fromId),
        fromRef: String(r.fromRef),
        toId: String(r.toId),
        toRef: String(r.toRef),
        decidedBy: String(r.decidedBy || '')
      };
    });
  }

  /**
   * Saves a request, stamping when it changed. A new one is added under the
   * others and gets its `_row`.
   *
   * @param {!Object} form The form.
   * @param {!Object} t The request, changed in place.
   * @return {!Object} The request.
   */
  function saveTransfer_(form, t) {
    t.updated = Time.nowIso();
    var sh = transfersSheet_(form, true);
    var o = Json.clone(t);
    o.member = JSON.stringify(t.member || {});
    if (t._row) Table.writeRow(sh, t._row, TRANSFER_COLS, o);
    else t._row = Table.appendPlain(sh, Table.rowValues(TRANSFER_COLS, o));
    return t;
  }

  return {
    TRANSFER_TAB: TRANSFER_TAB_,
    TRANSFER_COLS,
    readTransfers: readTransfers_,
    saveTransfer: saveTransfer_,
    transfersOn: transfersOn_
  };
})();
