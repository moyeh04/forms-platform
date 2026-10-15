/** The WhatsApp requests tab of a form. */

var REQUEST_COLS_ = [
  'id',
  'raw',
  'phone',
  'label',
  'added',
  'decision',
  'note'
];

function requestsSheet_(form) {
  return Table.ensureTab(
    SpreadsheetApp.openById(form.sheetId),
    'Requests',
    REQUEST_COLS_
  );
}

function readRequests_(form) {
  return Table.readTable(requestsSheet_(form), REQUEST_COLS_).map(function (r) {
    return {
      _row: r._row,
      id: String(r.id),
      raw: String(r.raw),
      phone: String(r.phone),
      label: String(r.label),
      added: String(r.added),
      decision: String(r.decision || 'pending'),
      note: String(r.note)
    };
  });
}
