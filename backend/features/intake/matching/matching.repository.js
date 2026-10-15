/** The WhatsApp requests tab of a form. */

var MatchingRepository = (function () {
  /** The columns of the Requests tab, in sheet order. */
  var REQUEST_COLS_ = [
    'id',
    'raw',
    'phone',
    'label',
    'added',
    'decision',
    'note'
  ];

  /**
   * Opens the Requests tab of a form, making it when it is missing.
   *
   * @param {!Object} form The form.
   * @return {!SpreadsheetApp.Sheet} The tab.
   */
  function requestsSheet_(form) {
    return Table.ensureTab(
      SpreadsheetApp.openById(form.sheetId),
      'Requests',
      REQUEST_COLS_
    );
  }

  /**
   * Reads the pasted join requests of a form.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} One request for each row, with its `_row`.
   */
  function readRequests_(form) {
    return Table.readTable(requestsSheet_(form), REQUEST_COLS_).map(
      function (r) {
        return {
          _row: r._row,
          id: String(r.id),
          raw: String(r.raw),
          phone: String(r.phone),
          label: String(r.label),
          added: String(r.added),
          decision: String(r.decision || ReviewStatus.PENDING),
          note: String(r.note)
        };
      }
    );
  }

  /**
   * Adds requests at the end of the tab.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} requests The new requests, without `_row`.
   */
  function addRequests_(form, requests) {
    var sh = requestsSheet_(form);
    requests.forEach(function (q) {
      Table.appendPlain(
        sh,
        REQUEST_COLS_.map(function (c) {
          return q[c];
        })
      );
    });
  }

  /**
   * Writes a changed request back to its row.
   *
   * @param {!Object} form The form.
   * @param {!Object} q The request, as read with its `_row`.
   */
  function saveRequest_(form, q) {
    Table.writeRow(requestsSheet_(form), q._row, REQUEST_COLS_, q);
  }

  /**
   * Deletes requests from the tab, the lowest row first so the rows above
   * do not move.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} requests The requests, as read with `_row`.
   */
  function deleteRequests_(form, requests) {
    var sh = requestsSheet_(form);
    requests
      .slice()
      .sort(function (a, b) {
        return b._row - a._row;
      })
      .forEach(function (q) {
        sh.deleteRow(q._row);
      });
  }

  return {
    REQUEST_COLS: REQUEST_COLS_,
    readRequests: readRequests_,
    addRequests: addRequests_,
    saveRequest: saveRequest_,
    deleteRequests: deleteRequests_
  };
})();
