/** Reading and writing the rows of a sheet tab by its header names. */

var Table = (function () {
  /** The first row under the header. */
  var FIRST_ROW_ = 2;

  /** How many rows a full tab grows by, so a row added later is in range. */
  var GROW_ROWS_ = 50;

  /**
   * Reads every row under the header as an object keyed by column name.
   *
   * @param {!SpreadsheetApp.Sheet} sheet The tab.
   * @param {!Array<string>} cols The names of its columns, in order.
   * @return {!Array<!Object>} One object for each row, with its sheet row
   *     number in `_row`.
   */
  function readTable(sheet, cols) {
    var last = sheet.getLastRow();
    if (last < FIRST_ROW_) return [];
    var vals = sheet.getRange(FIRST_ROW_, 1, last - 1, cols.length).getValues();
    return vals.map(function (r, i) {
      var o = { _row: i + FIRST_ROW_ };
      cols.forEach(function (c, j) {
        o[c] = r[j];
      });
      return o;
    });
  }

  /**
   * Lists the cells of a row in column order; a missing value is empty.
   *
   * @param {!Array<string>} cols The names of the columns.
   * @param {!Object} obj The row as an object.
   * @return {!Array<*>} The cells.
   */
  function rowValues(cols, obj) {
    return cols.map(function (c) {
      return obj[c] === undefined || obj[c] === null ? '' : obj[c];
    });
  }

  /**
   * Writes a row over the one at a sheet row number.
   *
   * @param {!SpreadsheetApp.Sheet} sheet The tab.
   * @param {number} rowIndex The sheet row number.
   * @param {!Array<string>} cols The names of the columns.
   * @param {!Object} obj The row as an object.
   */
  function writeRow(sheet, rowIndex, cols, obj) {
    sheet
      .getRange(rowIndex, 1, 1, cols.length)
      .setValues([rowValues(cols, obj)]);
  }

  /**
   * Adds a row at the end as plain text. A row past the ones a sheet was
   * made with has no format, and Sheets would turn "01012345678" into a
   * number there. Call it inside Lock.withLock.
   *
   * @param {!SpreadsheetApp.Sheet} sheet The tab.
   * @param {!Array<*>} values The cells.
   * @return {number} The sheet row number of the new row.
   */
  function appendPlain_(sheet, values) {
    var at = sheet.getLastRow() + 1;
    if (at > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), GROW_ROWS_);
    }
    sheet
      .getRange(at, 1, 1, values.length)
      .setNumberFormat('@')
      .setValues([values]);
    return at;
  }

  /**
   * Writes the header of every column a data tab is missing, so a tab made
   * before a column was added gets it.
   *
   * @param {!SpreadsheetApp.Sheet} sheet The tab.
   * @param {!Array<string>} cols The names of its columns.
   */
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

  /**
   * Gives a tab, made when it is missing, a bold header, a frozen first row
   * and plain-text cells.
   *
   * @param {!SpreadsheetApp.Spreadsheet} ss The spreadsheet.
   * @param {string} name The name of the tab.
   * @param {!Array<string>} headers The names of its columns.
   * @return {!SpreadsheetApp.Sheet} The tab.
   */
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

  return {
    readTable,
    ensureHeaders: ensureHeaders_,
    writeRow,
    appendPlain: appendPlain_,
    rowValues,
    ensureTab
  };
})();
