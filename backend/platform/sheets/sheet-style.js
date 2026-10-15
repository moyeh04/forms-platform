/**
 * How the sheets look: the palette every painted tab shares, and the look of
 * a data tab, such as the registry's Forms tab or a form's Responses tab. A
 * data tab gets the header of the tinted views, a frozen first row, column
 * widths that fit what a column holds, alternating row tints, and long cells
 * cut short at the cell edge so every row stays one line tall.
 *
 * Only the look changes. No value and no number format is written, so
 * everything the platform reads back is what it was.
 */

var SheetStyle = (function () {
  /**
   * The colours and font of every painted tab: the dark header (`ink` with
   * `onInk` text), the grid lines, and two groups of tints that alternate
   * from one team or day to the next.
   */
  var PALETTE = Object.freeze({
    ink: '#3A2A1A',
    onInk: '#F3E6C4',
    grid: '#C9B58A',
    font: 'Arial',
    groups: [
      { shades: ['#DCEAE4', '#EEF5F1'], solid: '#3F6B66' },
      { shades: ['#F0E4C6', '#F8F1DE'], solid: '#8E2B22' }
    ]
  });

  /** Tints of the rows under the header, the lighter one first. */
  var DATA_TAB_ROWS_ = ['#FFFFFF', '#F8F1DE'];

  /** The height of a data tab's header row, in pixels. */
  var DATA_TAB_HEADER_PX_ = 32;

  /** The width of a column that `DATA_TAB_WIDTHS_` does not name, in pixels. */
  var DATA_TAB_WIDTH_ = 140;

  /** The width of each column by its name, in pixels. */
  var DATA_TAB_WIDTHS_ = {
    id: 110,
    ref: 120,
    number: 80,
    status: 100,
    deleted: 80,
    code: 100,
    phone: 130,
    slug: 260,
    type: 170,
    term: 110,
    name: 240,
    email: 220,
    title: 260,
    link: 260,
    slot: 200,
    members: 320,
    data: 320,
    review: 200,
    progress: 320,
    config: 320,
    key: 180,
    values: 520,
    raw: 320,
    label: 220,
    note: 220,
    member: 320,
    forms: 260,
    hiddenColumns: 200,
    sheetUrl: 260,
    created: 170,
    updated: 170,
    createdAt: 170,
    updatedAt: 170,
    opensAt: 170,
    closesAt: 170,
    keyExpires: 170,
    expires: 170,
    added: 170
  };

  /**
   * Says whether a tab already has the look for exactly these columns and
   * all of its rows.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<string>} cols The names of its columns.
   * @return {boolean} True when nothing needs painting.
   */
  function dataTabStyled_(sh, cols) {
    var last = String(
      sh.getRange(1, cols.length).getBackground()
    ).toLowerCase();
    if (last !== PALETTE.ink.toLowerCase()) return false;
    return sh.getBandings().some(function (b) {
      return (
        b.getRange().getNumRows() === sh.getMaxRows() &&
        b.getRange().getNumColumns() === cols.length
      );
    });
  }

  /**
   * Gives a data tab its look. A tab that refuses a format stays as far as
   * it got and is tried again on the next repaint: the look never stops a
   * repaint or a new form.
   *
   * @param {?SpreadsheetApp.Sheet} sh The tab, or null when it is missing.
   * @param {!Array<string>} cols The names of its columns.
   * @return {boolean} True when it was painted; false when it had the look
   *     already, which costs three reads, or could not be painted.
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

  /**
   * Paints the header row of a data tab and freezes it.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {number} n How many columns it has.
   */
  function paintDataHeader_(sh, n) {
    sh.getRange(1, 1, 1, n)
      .setBackground(PALETTE.ink)
      .setFontColor(PALETTE.onInk)
      .setFontWeight('bold')
      .setFontFamily(PALETTE.font)
      .setVerticalAlignment('middle');
    sh.setRowHeight(1, DATA_TAB_HEADER_PX_);
    sh.setFrozenRows(1);
  }

  /**
   * Paints a data tab: its header, its column widths, its rows cut at the
   * cell edge, and one banding over every row.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<string>} cols The names of its columns.
   */
  function paintDataTab_(sh, cols) {
    var rows = sh.getMaxRows();
    var n = cols.length;
    paintDataHeader_(sh, n);
    cols.forEach(function (name, i) {
      sh.setColumnWidth(i + 1, DATA_TAB_WIDTHS_[name] || DATA_TAB_WIDTH_);
    });
    if (rows > 1) {
      sh.getRange(2, 1, rows - 1, n)
        .setFontFamily(PALETTE.font)
        .setVerticalAlignment('middle')
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    }
    sh.getBandings().forEach(function (b) {
      b.remove();
    });
    sh.getRange(1, 1, rows, n)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor(PALETTE.ink)
      .setFirstRowColor(DATA_TAB_ROWS_[0])
      .setSecondRowColor(DATA_TAB_ROWS_[1]);
  }

  return { PALETTE, styleDataTab: styleDataTab_ };
})();
