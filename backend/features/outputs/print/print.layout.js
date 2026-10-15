/**
 * The layout every print tab shares: its name, its title and header rows,
 * where its data starts, its frame and the note of an empty tab.
 */

var PrintLayout = (function () {
  /** The row of the column headers; the title is row one. */
  var HEADER_ROW = 3;

  /** The first row of data, under the header row. */
  var FIRST_ROW = 4;

  /** The font size of the header and of the data rows. */
  var BODY_FONT = 12;

  /** The fill of the header row and of the merged labels. */
  var LABEL_FILL = '#E9DFC4';

  /** The colour of the text and the frame of a printed page. */
  var BLACK = '#000000';

  /** The font size of the title row. */
  var TITLE_FONT_ = 16;

  /** The height of the title row, in pixels. */
  var TITLE_PX_ = 44;

  /** The height of the header row, in pixels. */
  var HEADER_PX_ = 34;

  /** The longest tab name the layout makes. */
  var MAX_NAME_LENGTH_ = 90;

  /** The characters a tab name may not hold. */
  var BAD_NAME_CHARS_ = /[[\]*?:/\\]/g;

  /**
   * Makes the name of a print tab.
   *
   * @param {*} label What the tab shows, such as a day.
   * @return {string} `Print - ` and the label, cut to the longest name.
   */
  function sheetName(label) {
    var name = 'Print - ' + String(label).replace(BAD_NAME_CHARS_, '-');
    return name.slice(0, MAX_NAME_LENGTH_);
  }

  /**
   * Paints the merged title row and the header row of a print tab.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {string} title The title.
   * @param {!Array<string>} headers The column headers.
   */
  function paintHeader(sh, title, headers) {
    var cols = headers.length;
    sh.getRange(1, 1, 1, cols)
      .merge()
      .setValue(title)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setFontSize(TITLE_FONT_)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sh.setRowHeight(1, TITLE_PX_);
    sh.getRange(HEADER_ROW, 1, 1, cols)
      .setValues([headers])
      .setFontFamily(SheetStyle.PALETTE.font)
      .setFontSize(BODY_FONT)
      .setFontWeight('bold')
      .setBackground(LABEL_FILL)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sh.setRowHeight(HEADER_ROW, HEADER_PX_);
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
   * Draws solid lines around and inside a block of cells.
   *
   * @param {!SpreadsheetApp.Range} range The cells.
   * @param {string} colour The colour of the lines.
   */
  function frame(range, colour) {
    range.setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      colour,
      SpreadsheetApp.BorderStyle.SOLID
    );
  }

  /**
   * Writes one centred note across the first data row of an empty tab.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {number} cols How many columns it has.
   * @param {string} note The note.
   */
  function emptyNote(sh, cols, note) {
    sh.getRange(FIRST_ROW, 1, 1, cols)
      .merge()
      .setValue(note)
      .setHorizontalAlignment('center');
  }

  /**
   * Describes a printed tab.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {number} count How many bookings or teams it shows.
   * @return {{sheetName: string, gid: number, count: number,
   *     landscape: boolean}} The tab.
   */
  function printed(sh, count) {
    return {
      sheetName: sh.getName(),
      gid: sh.getSheetId(),
      count: count,
      landscape: false
    };
  }

  return {
    HEADER_ROW,
    FIRST_ROW,
    BODY_FONT,
    LABEL_FILL,
    BLACK,
    sheetName,
    paintHeader,
    setWidths,
    frame,
    emptyNote,
    printed
  };
})();
