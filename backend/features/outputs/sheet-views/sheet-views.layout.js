/**
 * The look of the sheet views: headers, frames, merged labels and links, and
 * of the data tabs of a form's spreadsheet.
 */

var SheetViewsLayout = (function () {
  function freshView_(ss, name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
    return sh;
  }

  function paintHeader_(sh, headers) {
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(SheetStyle.PALETTE.ink)
      .setFontColor(SheetStyle.PALETTE.onInk)
      .setFontWeight('bold')
      .setFontSize(12)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sh.setRowHeight(1, 40);
    sh.setFrozenRows(1);
  }

  function emptyView_(sh, cols, text) {
    sh.getRange(2, 1, 1, cols)
      .merge()
      .setValue(text)
      .setHorizontalAlignment('center')
      .setFontColor('#6B5535')
      .setFontFamily(SheetStyle.PALETTE.font);
  }

  /** Thin grid inside, heavy frame around each block. */
  function frameBlocks_(sh, cols, firstRow, lastRow, blocks) {
    sh.getRange(firstRow, 1, lastRow - firstRow + 1, cols).setBorder(
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
      sh.getRange(b.start, 1, b.length, cols).setBorder(
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

  function mergedLabel_(sh, row, col, length, value, formula, solid) {
    var r = sh.getRange(row, col, length, 1);
    if (length > 1) r.merge();
    var anchor = sh.getRange(row, col);
    if (formula) anchor.setFormula(formula);
    else anchor.setValue(value);
    r.setBackground(solid)
      .setFontColor(SheetStyle.PALETTE.onInk)
      .setFontWeight('bold')
      .setFontSize(13)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
  }

  function hyperlink_(url, text) {
    return (
      '=HYPERLINK("' +
      String(url).replace(/"/g, '""') +
      '","' +
      String(text).replace(/"/g, '""') +
      '")'
    );
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
    styleFormTabs,
    freshView: freshView_,
    mergedLabel: mergedLabel_,
    hyperlink: hyperlink_,
    frameBlocks: frameBlocks_,
    paintHeader: paintHeader_,
    emptyView: emptyView_
  };
})();
