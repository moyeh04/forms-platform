/** The look of the sheet views: headers, frames, merged labels and links. */

var SheetViewsLayout = (function () {
  var VIEW_STYLE_ = {
    ink: '#3A2A1A',
    onInk: '#F3E6C4',
    grid: '#C9B58A',
    font: 'Arial',
    groups: [
      { shades: ['#DCEAE4', '#EEF5F1'], solid: '#3F6B66' },
      { shades: ['#F0E4C6', '#F8F1DE'], solid: '#8E2B22' }
    ]
  };

  function freshView_(ss, name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
    sh.clear();
    return sh;
  }

  function paintHeader_(sh, headers) {
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setBackground(VIEW_STYLE_.ink)
      .setFontColor(VIEW_STYLE_.onInk)
      .setFontWeight('bold')
      .setFontSize(12)
      .setFontFamily(VIEW_STYLE_.font)
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
      .setFontFamily(VIEW_STYLE_.font);
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
      VIEW_STYLE_.grid,
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
        VIEW_STYLE_.ink,
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
      .setFontColor(VIEW_STYLE_.onInk)
      .setFontWeight('bold')
      .setFontSize(13)
      .setFontFamily(VIEW_STYLE_.font)
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

  return {
    VIEW_STYLE: VIEW_STYLE_,
    freshView: freshView_,
    mergedLabel: mergedLabel_,
    hyperlink: hyperlink_,
    frameBlocks: frameBlocks_,
    paintHeader: paintHeader_,
    emptyView: emptyView_
  };
})();
