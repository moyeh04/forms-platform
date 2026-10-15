/** Reading and writing the rows of a sheet tab by its header names. */

function readTable(sheet, cols) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, cols.length).getValues();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    cols.forEach(function (c, j) {
      o[c] = r[j];
    });
    return o;
  });
}

function rowValues(cols, obj) {
  return cols.map(function (c) {
    return obj[c] === undefined || obj[c] === null ? '' : obj[c];
  });
}

function writeRow(sheet, rowIndex, cols, obj) {
  sheet.getRange(rowIndex, 1, 1, cols.length).setValues([rowValues(cols, obj)]);
}

/**
 * Adds a row at the end as plain text and returns its number. A row past the ones a sheet was
 * made with has no format, and Sheets would turn "01012345678" into a number there. Call it
 * inside withLock_.
 */
function appendPlain_(sheet, values) {
  var at = sheet.getLastRow() + 1;
  if (at > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 50);
  sheet
    .getRange(at, 1, 1, values.length)
    .setNumberFormat('@')
    .setValues([values]);
  return at;
}

/** Writes the header of every column a data tab is missing: a tab made before a column was added gets it here. */
function ensureHeaders_(sheet, cols) {
  var have = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
  cols.forEach(function (name, i) {
    if (String(have[i]) !== name)
      sheet
        .getRange(1, i + 1)
        .setValue(name)
        .setFontWeight('bold');
  });
}

/** Creates a tab with a bold header, frozen first row and plain-text cells. */
function ensureTab(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0)
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold');
  sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  sh.setFrozenRows(1);
  return sh;
}
