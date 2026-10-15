/** The Responses tab of a form: reading and saving submissions. */

var ResponsesRepository = (function () {
  /** The columns of the Responses tab, in sheet order. */
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

  /** The statuses a submission can have. */
  var SUBMISSION_STATUSES = [
    'new',
    'in_review',
    'approved',
    'rejected',
    'done'
  ];

  /** How many digits the count at the end of a reference has. */
  var REF_DIGITS_ = 4;

  /** The letters a reference starts with, by form type. */
  var REF_PREFIX_ = {
    team_registration: 'TR',
    task_submission: 'TK',
    reservation: 'RS',
    whatsapp_registration: 'WA'
  };

  /**
   * Opens the Responses tab of a form.
   *
   * @param {!Object} form The form.
   * @return {?SpreadsheetApp.Sheet} The tab.
   */
  function responsesSheet(form) {
    var ss = SpreadsheetApp.openById(form.sheetId);
    return ss.getSheetByName('Responses');
  }

  /**
   * Turns a row of the tab into a response.
   *
   * @param {!Object} r The row, by column name.
   * @return {!Object} The response, with its `_row`.
   */
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
      deleted: Cell.readFlag(r.deleted, false),
      keySeal: String(r.keySeal || ''),
      number: parseInt(r.number, 10) || 0
    };
  }

  /**
   * Reads the responses of a form.
   *
   * @param {!Object} form The form.
   * @param {boolean=} includeDeleted True to keep cancelled ones.
   * @return {!Array<!Object>} The responses.
   */
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

  /**
   * Turns a response into the values of its row.
   *
   * @param {!Object} r The response.
   * @return {!Object} The row, by column name.
   */
  function responseToRow_(r) {
    var o = Json.clone(r);
    o.review = JSON.stringify(r.review || {});
    o.data = JSON.stringify(r.data || {});
    o.deleted = Cell.writeFlag(r.deleted, '');
    o.number = r.number ? String(r.number) : '';
    return o;
  }

  /**
   * Saves a response to its row, or adds a row for a new one.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The response; its time of change and `_row` are set.
   * @return {!Object} The same response.
   */
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

  /**
   * Fills the readable columns from the validated data.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The response, changed in place.
   * @return {!Object} The same response.
   */
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

  /**
   * Makes the reference of the next response: the prefix of the form type,
   * the year and the count.
   *
   * @param {!Object} form The form.
   * @return {string} The reference, such as `TR-2026-0007`.
   */
  function nextRef_(form) {
    var count = Math.max(0, responsesSheet(form).getLastRow() - 1);
    var year = new Date().getUTCFullYear();
    return (
      (REF_PREFIX_[form.type] || 'FM') +
      '-' +
      year +
      '-' +
      ('0'.repeat(REF_DIGITS_ - 1) + (count + 1)).slice(-REF_DIGITS_)
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
