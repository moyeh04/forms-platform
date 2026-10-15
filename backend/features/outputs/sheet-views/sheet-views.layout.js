/**
 * The look of the sheet views: headers, frames, merged labels and links, and
 * of the data tabs of a form's spreadsheet.
 */

var SheetViewsLayout = (function () {
  /** The first row under the header of a view. */
  var FIRST_ROW = 2;

  /** The font size of the rows of a view. */
  var BODY_FONT = 11;

  /** The font size of the header row. */
  var HEADER_FONT_ = 12;

  /** The height of the header row, in pixels. */
  var HEADER_PX_ = 40;

  /** The font size of a merged label. */
  var LABEL_FONT_ = 13;

  /** The colour of the note of an empty view. */
  var EMPTY_INK_ = '#6B5535';

  /**
   * Opens a view tab empty, making it when it is missing.
   *
   * @param {!SpreadsheetApp.Spreadsheet} ss The spreadsheet.
   * @param {string} name The name of the tab.
   * @return {!SpreadsheetApp.Sheet} The tab, unmerged and cleared.
   */
  function freshView_(ss, name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
    return sh;
  }

  /**
   * Paints the dark header row of a view and freezes it.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<string>} headers The column headers.
   */
  function paintHeader_(sh, headers) {
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(SheetStyle.PALETTE.ink)
      .setFontColor(SheetStyle.PALETTE.onInk)
      .setFontWeight('bold')
      .setFontSize(HEADER_FONT_)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sh.setRowHeight(1, HEADER_PX_);
    sh.setFrozenRows(1);
  }

  /**
   * Sets the width of each column, from the first one.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<number>} widths The widths, in pixels.
   */
  function setWidths(sh, widths) {
    widths.forEach(function (w, i) {
      sh.setColumnWidth(i + 1, w);
    });
  }

  /**
   * Writes the rows of a view under its header, with their tints.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<!Array<*>>} values The rows.
   * @param {!Array<!Array<string>>} shades The tint of each cell.
   */
  function writeRows(sh, values, shades) {
    sh.getRange(FIRST_ROW, 1, values.length, values[0].length)
      .setValues(values)
      .setBackgrounds(shades)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setFontSize(BODY_FONT)
      .setVerticalAlignment('middle');
  }

  /**
   * Writes one quiet note across the first row of an empty view.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {number} cols How many columns it has.
   * @param {string} text The note.
   */
  function emptyView_(sh, cols, text) {
    sh.getRange(FIRST_ROW, 1, 1, cols)
      .merge()
      .setValue(text)
      .setHorizontalAlignment('center')
      .setFontColor(EMPTY_INK_)
      .setFontFamily(SheetStyle.PALETTE.font);
  }

  /**
   * Draws a thin grid inside the rows and a heavy frame around each block.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {{cols: number, first: number, last: number}} area How many
   *     columns, and the first and last row of the grid.
   * @param {!Array<{start: number, length: number}>} blocks The blocks.
   */
  function frameBlocks_(sh, area, blocks) {
    var rows = area.last - area.first + 1;
    sh.getRange(area.first, 1, rows, area.cols).setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      SheetStyle.PALETTE.grid,
      SpreadsheetApp.BorderStyle.SOLID
    );
    blocks.forEach(function (b) {
      sh.getRange(b.start, 1, b.length, area.cols).setBorder(
        true,
        true,
        true,
        true,
        false,
        false,
        SheetStyle.PALETTE.ink,
        SpreadsheetApp.BorderStyle.SOLID_THICK
      );
    });
  }

  /**
   * Writes a bold label down the side of a block, merged over its rows.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {{row: number, col: number, length: number}} at The first cell
   *     and how many rows it covers.
   * @param {{value: *, formula: string, fill: string}} label The text, a
   *     formula that shows it instead when not empty, and the fill.
   */
  function mergedLabel_(sh, at, label) {
    var r = sh.getRange(at.row, at.col, at.length, 1);
    if (at.length > 1) r.merge();
    var anchor = sh.getRange(at.row, at.col);
    if (label.formula) anchor.setFormula(label.formula);
    else anchor.setValue(label.value);
    r.setBackground(label.fill)
      .setFontColor(SheetStyle.PALETTE.onInk)
      .setFontWeight('bold')
      .setFontSize(LABEL_FONT_)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
  }

  /**
   * Makes a link formula.
   *
   * @param {*} url Where it goes.
   * @param {*} text What it shows.
   * @return {string} The `=HYPERLINK` formula, with its quotes doubled.
   */
  function hyperlink_(url, text) {
    var quoted = [url, text].map(function (s) {
      return '"' + String(s).replace(/"/g, '""') + '"';
    });
    return '=HYPERLINK(' + quoted.join(',') + ')';
  }

  /**
   * Gives the data tabs of one form's spreadsheet their look. Transfers and
   * Requests exist only on forms that used them; a missing tab is skipped.
   *
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function styleFormTabs(ss) {
    SheetStyle.styleDataTab(
      ss.getSheetByName('Responses'),
      ResponsesRepository.RESPONSE_COLS
    );
    SheetStyle.styleDataTab(
      ss.getSheetByName(TransfersRepository.TRANSFER_TAB),
      TransfersRepository.TRANSFER_COLS
    );
    SheetStyle.styleDataTab(
      ss.getSheetByName('Requests'),
      MatchingRepository.REQUEST_COLS
    );
  }

  return {
    FIRST_ROW,
    BODY_FONT,
    styleFormTabs,
    freshView: freshView_,
    mergedLabel: mergedLabel_,
    hyperlink: hyperlink_,
    frameBlocks: frameBlocks_,
    paintHeader: paintHeader_,
    setWidths,
    writeRows,
    emptyView: emptyView_
  };
})();
