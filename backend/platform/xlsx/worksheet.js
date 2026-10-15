/**
 * One sheet of an Excel file: its cells, column widths, merged ranges,
 * links, frozen header row and print setup.
 */

var Worksheet = (function () {
  /** The narrowest and widest fitted column, in characters. */
  var MIN_WIDTH_ = 6;
  var MAX_WIDTH_ = 60;

  /** How much wider bold text is than plain. */
  var BOLD_SCALE_ = 1.15;

  /** The room the edges of a cell take, in characters. */
  var CELL_PADDING_ = 3;

  /** The row height a row without one gets, in points. */
  var ROW_HEIGHT_ = 15;

  /** The paper size of A4. */
  var PAPER_A4_ = 9;

  /** The page margins, in inches. */
  var PAGE_MARGINS_ = {
    left: 0.4,
    right: 0.4,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3
  };

  /**
   * Measures the longest line of a cell.
   *
   * @param {*} cell The cell.
   * @return {number} Its longest line, in characters.
   */
  function longestLine_(cell) {
    var o = cell != null && typeof cell === 'object' ? cell : { v: cell };
    return String(o.v == null ? '' : o.v)
      .split('\n')
      .reduce(function (m, line) {
        return Math.max(m, line.length);
      }, 0);
  }

  /**
   * Gives each column the width of its longest line, in Excel's units of
   * about one character. Bold text and the padding of a cell add a little;
   * a longer value wraps at the widest width.
   *
   * @param {!Array<!Array<*>>} rows The rows of the sheet.
   * @return {!Array<number>} The width of each column.
   */
  function fitWidths_(rows) {
    var widths = [];
    rows.forEach(function (row) {
      row.forEach(function (cell, c) {
        var fit = Math.ceil(longestLine_(cell) * BOLD_SCALE_) + CELL_PADDING_;
        widths[c] = Math.max(
          widths[c] || MIN_WIDTH_,
          Math.min(MAX_WIDTH_, fit)
        );
      });
    });
    return widths;
  }

  /**
   * Writes a cell, and notes its link.
   *
   * @param {*} cell The cell.
   * @param {string} ref Where it is, such as `B3`.
   * @param {!Array<!Object>} links The links of the sheet; a link of this
   *     cell is added.
   * @return {string} The c element, or nothing for an empty cell.
   */
  function cell_(cell, ref, links) {
    if (cell == null || cell === '') return '';
    var o = typeof cell === 'object' ? cell : { v: cell };
    if (o.link) links.push({ ref: ref, target: o.link });
    var attrs = { r: ref, s: o.style || undefined };
    if (o.v == null || o.v === '') return Xml.element('c', attrs);
    if (typeof o.v === 'number') {
      return Xml.element('c', attrs, Xml.element('v', null, o.v));
    }
    attrs.t = 'inlineStr';
    var text = Xml.element('t', { 'xml:space': 'preserve' }, Xml.xmlText(o.v));
    return Xml.element('c', attrs, Xml.element('is', null, text));
  }

  /**
   * Writes the rows of a sheet, and notes their links.
   *
   * @param {!Object} sheet The sheet.
   * @param {!Array<!Object>} links Where the links of its cells are added.
   * @return {string} The row elements.
   */
  function rows_(sheet, links) {
    return sheet.rows
      .map(function (row, r) {
        var cells = row.map(function (cell, c) {
          return cell_(cell, Xml.xlsxColumn(c) + (r + 1), links);
        });
        var attrs = {
          r: r + 1,
          ht: sheet.heights || undefined,
          customHeight: sheet.heights ? 1 : undefined
        };
        return Xml.element('row', attrs, cells.join(''));
      })
      .join('');
  }

  /**
   * Writes the column widths of a sheet.
   *
   * @param {!Object} sheet The sheet.
   * @return {string} The cols element, or nothing when there are no columns.
   */
  function columns_(sheet) {
    var cols = (sheet.widths || fitWidths_(sheet.rows)).map(function (w, i) {
      var at = i + 1;
      return Xml.element('col', { min: at, max: at, width: w, customWidth: 1 });
    });
    return cols.length ? Xml.element('cols', null, cols.join('')) : '';
  }

  /**
   * Writes the merged ranges of a sheet.
   *
   * @param {!Object} sheet The sheet.
   * @return {string} The mergeCells element, or nothing.
   */
  function merges_(sheet) {
    var merges = (sheet.merges || []).map(function (m) {
      return Xml.element('mergeCell', { ref: m });
    });
    return merges.length ? Xml.counted('mergeCells', merges) : '';
  }

  /**
   * Writes the cells that hold links. Link `i` is relationship `rId<i+1>`.
   *
   * @param {!Array<!Object>} links The links.
   * @return {string} The hyperlinks element, or nothing.
   */
  function hyperlinks_(links) {
    if (!links.length) return '';
    var items = links.map(function (l, i) {
      return Xml.element('hyperlink', { ref: l.ref, 'r:id': 'rId' + (i + 1) });
    });
    return Xml.element('hyperlinks', null, items.join(''));
  }

  /**
   * Writes how a sheet shows and prints: the first row frozen, one page wide
   * on A4.
   *
   * @return {!Object} The XML before the data (`head`) and after it
   *     (`tail`).
   */
  function sheetSetup_() {
    var pane = Xml.element('pane', {
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen'
    });
    var view = Xml.element('sheetView', { workbookViewId: 0 }, pane);
    return {
      head:
        Xml.element(
          'sheetPr',
          null,
          Xml.element('pageSetUpPr', { fitToPage: 1 })
        ) +
        Xml.element('sheetViews', null, view) +
        Xml.element('sheetFormatPr', { defaultRowHeight: ROW_HEIGHT_ }),
      tail:
        Xml.element('pageMargins', PAGE_MARGINS_) +
        Xml.element('pageSetup', {
          paperSize: PAPER_A4_,
          fitToWidth: 1,
          fitToHeight: 0
        })
    };
  }

  /**
   * Writes a sheet and the links of its cells.
   *
   * @param {!Object} sheet The sheet.
   * @return {{xml: string, rels: string}} The sheet, and its .rels file or
   *     nothing when no cell has a link.
   */
  function worksheet_(sheet) {
    var links = [];
    var data = Xml.element('sheetData', null, rows_(sheet, links));
    var setup = sheetSetup_();
    var xml =
      Xml.DECLARATION +
      Xml.element(
        'worksheet',
        { xmlns: Xml.NS.main, 'xmlns:r': Xml.NS.rel },
        setup.head +
          columns_(sheet) +
          data +
          merges_(sheet) +
          hyperlinks_(links) +
          setup.tail
      );
    var targets = links.map(function (l, i) {
      return Xml.relationship(i + 1, 'hyperlink', Xml.xmlText(l.target), true);
    });
    return { xml: xml, rels: links.length ? Xml.relationships(targets) : '' };
  }

  return { write: worksheet_ };
})();
