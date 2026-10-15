/** The Transfers tab of a form: reading and saving move requests. */

var TransfersRepository = (function () {
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

  var TRANSFER_TAB_ = 'Transfers';

  function transfersOn_(form) {
    var rules = form.rules || {};
    return !!(
      rules.transfers &&
      rules.uniqueAcrossForm &&
      Rules.fieldByRole(form, 'members')
    );
  }

  function transfersSheet_(form, create) {
    var ss = SpreadsheetApp.openById(form.sheetId);
    return create
      ? Table.ensureTab(ss, TRANSFER_TAB_, TRANSFER_COLS)
      : ss.getSheetByName(TRANSFER_TAB_);
  }

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
