/**
 * How the data tabs look: the registry's Forms, Clients and Lists, and each form's Responses,
 * Transfers and Requests. They get the header of the tinted views, a frozen first row, column
 * widths that fit what a column holds, alternating row tints, and long cells cut short at the
 * cell edge so every row stays one line tall.
 *
 * Only the look changes. No value and no number format is written, so everything the platform
 * reads back is what it was.
 */

/** Tints of the rows under the header, the lighter one first. */
var DATA_TAB_ROWS_ = ['#FFFFFF', '#F8F1DE'];

/** Width in pixels by column name; a column that is not named here gets the default. */
var DATA_TAB_WIDTH_ = 140;
var DATA_TAB_WIDTHS_ = {
  id: 110, ref: 120, number: 80, status: 100, deleted: 80, code: 100, phone: 130, slug: 260, type: 170, term: 110,
  name: 240, email: 220, title: 260, link: 260, slot: 200, members: 320, data: 320, review: 200, config: 320,
  key: 180, values: 520, raw: 320, label: 220, note: 220, member: 320, forms: 260, hiddenColumns: 200,
  sheetUrl: 260, created: 170, updated: 170, createdAt: 170, updatedAt: 170, opensAt: 170, closesAt: 170,
  keyExpires: 170, expires: 170, added: 170
};

/** True when the tab already has the look for exactly these columns and all of its rows. */
function dataTabStyled_(sh, cols) {
  var last = String(sh.getRange(1, cols.length).getBackground()).toLowerCase();
  if (last !== VIEW_STYLE_.ink.toLowerCase()) return false;
  return sh.getBandings().some(function (b) {
    return b.getRange().getNumRows() === sh.getMaxRows() && b.getRange().getNumColumns() === cols.length;
  });
}

/**
 * Gives a data tab its look. Returns false when it had it already, which costs three reads.
 * A tab that refuses a format stays as far as it got and is tried again on the next repaint: the
 * look never stops a repaint or a new form.
 */
function styleDataTab_(sh, cols) {
  try {
    if (!sh || dataTabStyled_(sh, cols)) return false;
    paintDataTab_(sh, cols);
    return true;
  } catch (e) {
    Logger.log('Tab ' + sh.getName() + ' not styled: ' + e.message);
    return false;
  }
}

function paintDataTab_(sh, cols) {
  var rows = sh.getMaxRows(), n = cols.length;
  sh.getRange(1, 1, 1, n).setBackground(VIEW_STYLE_.ink).setFontColor(VIEW_STYLE_.onInk).setFontWeight('bold')
    .setFontFamily(VIEW_STYLE_.font).setVerticalAlignment('middle');
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  cols.forEach(function (name, i) { sh.setColumnWidth(i + 1, DATA_TAB_WIDTHS_[name] || DATA_TAB_WIDTH_); });
  if (rows > 1) {
    sh.getRange(2, 1, rows - 1, n).setFontFamily(VIEW_STYLE_.font).setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  }
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(1, 1, rows, n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(VIEW_STYLE_.ink).setFirstRowColor(DATA_TAB_ROWS_[0]).setSecondRowColor(DATA_TAB_ROWS_[1]);
}

/** The data tabs of one form's spreadsheet. Transfers and Requests exist only on forms that used them. */
function styleFormTabs_(ss) {
  styleDataTab_(ss.getSheetByName('Responses'), RESPONSE_COLS);
  styleDataTab_(ss.getSheetByName(TRANSFER_TAB_), TRANSFER_COLS);
  styleDataTab_(ss.getSheetByName('Requests'), REQUEST_COLS_);
}

/** The three tabs of the registry. */
function styleRegistryTabs_() {
  var ss = registry();
  styleDataTab_(ss.getSheetByName(TABS.forms), FORM_COLS);
  styleDataTab_(ss.getSheetByName(TABS.clients), CLIENT_COLS_);
  styleDataTab_(ss.getSheetByName(TABS.lists), ['key', 'values']);
}
