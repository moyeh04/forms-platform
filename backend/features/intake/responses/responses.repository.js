/** The Responses tab of a form: reading and saving submissions. */

var ResponsesRepository = (function () {
  var RESPONSE_COLS = [
    'id',
    'ref',
    'created',
    'updated',
    'status',
    'review',
    'email',
    'name',
    'code',
    'phone',
    'title',
    'link',
    'slot',
    'members',
    'data',
    'keyHash',
    'keyExpires',
    'deleted',
    'keySeal',
    'number'
  ];

  var SUBMISSION_STATUSES = [
    'new',
    'in_review',
    'approved',
    'rejected',
    'done'
  ];

  var REF_PREFIX_ = {
    team_registration: 'TR',
    task_submission: 'TK',
    reservation: 'RS',
    whatsapp_registration: 'WA'
  };

  function responsesSheet(form) {
    var ss = SpreadsheetApp.openById(form.sheetId);
    return ss.getSheetByName('Responses');
  }

  function rowToResponse_(r) {
    return {
      _row: r._row,
      id: String(r.id),
      ref: String(r.ref),
      created: String(r.created),
      updated: String(r.updated),
      status: String(r.status || 'new'),
      review: Json.parseJson(r.review, {}),
      email: String(r.email),
      name: String(r.name),
      code: String(r.code),
      phone: String(r.phone),
      title: String(r.title),
      link: String(r.link),
      slot: String(r.slot),
      members: String(r.members),
      data: Json.parseJson(r.data, {}),
      keyHash: String(r.keyHash),
      keyExpires: String(r.keyExpires),
      deleted: String(r.deleted) === '1',
      keySeal: String(r.keySeal || ''),
      number: parseInt(r.number, 10) || 0
    };
  }

  function readResponses(form, includeDeleted) {
    var rows = Table.readTable(responsesSheet(form), RESPONSE_COLS).map(
      rowToResponse_
    );
    return includeDeleted
      ? rows
      : rows.filter(function (r) {
          return !r.deleted;
        });
  }

  function responseToRow_(r) {
    var o = Json.clone(r);
    o.review = JSON.stringify(r.review || {});
    o.data = JSON.stringify(r.data || {});
    o.deleted = r.deleted ? '1' : '';
    o.number = r.number ? String(r.number) : '';
    return o;
  }

  function saveResponse_(form, r) {
    r.updated = Time.nowIso();
    var sh = responsesSheet(form);
    Table.ensureHeaders(sh, RESPONSE_COLS);
    if (r._row) Table.writeRow(sh, r._row, RESPONSE_COLS, responseToRow_(r));
    else
      r._row = Table.appendPlain(
        sh,
        Table.rowValues(RESPONSE_COLS, responseToRow_(r))
      );
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
    r.slot =
      slotField && d[slotField.id]
        ? Rules.slotKey(d[slotField.id].day, d[slotField.id].time)
        : '';
    r.members = Rules.membersOf(form, d)
      .filter(function (m) {
        return !m.leader;
      })
      .map(function (m) {
        return m.name + ' (' + m.code + ')';
      })
      .join('; ');
    return r;
  }

  function nextRef_(form) {
    var count = Math.max(0, responsesSheet(form).getLastRow() - 1);
    var year = new Date().getUTCFullYear();
    return (
      (REF_PREFIX_[form.type] || 'FM') +
      '-' +
      year +
      '-' +
      ('000' + (count + 1)).slice(-4)
    );
  }

  return {
    RESPONSE_COLS,
    readResponses,
    saveResponse: saveResponse_,
    SUBMISSION_STATUSES,
    applyDerived: applyDerived_,
    nextRef: nextRef_,
    responsesSheet
  };
})();
