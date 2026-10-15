/**
 * The Registrations view of a WhatsApp group form: everyone by group and
 * section, with a link to their timetable and where their review stands.
 */

var SheetViewsRegistrations = (function () {
  /** The width of each column, in pixels. */
  var COLUMN_PX_ = {
    number: 60,
    name: 300,
    code: 110,
    phone: 130,
    group: 80,
    section: 90,
    timetable: 120,
    review: 320
  };

  /** The widths in column order. */
  var WIDTHS_ = Object.values(COLUMN_PX_);

  /** How many columns the view has. */
  var COLS_ = WIDTHS_.length;

  /** The column of the timetable link. */
  var LINK_COL_ = 7;

  /** The height of a registration row, in pixels. */
  var ROW_PX_ = 30;

  /** The base of a section number. */
  var DECIMAL_ = 10;

  /**
   * Sorts registrations by group, then section, then when they came.
   *
   * @param {!Object} a One registration.
   * @param {!Object} b Another.
   * @return {number} Below zero when `a` comes first.
   */
  function byGroup_(a, b) {
    var ga = String(a.data.group);
    var gb = String(b.data.group);
    if (ga !== gb) return ga < gb ? -1 : 1;
    var sa = parseInt(a.data.section, DECIMAL_) || 0;
    var sb = parseInt(b.data.section, DECIMAL_) || 0;
    return sa - sb || SheetViewsBuilder.byCreated(a, b);
  }

  /**
   * Writes where each review step of a registration stands.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The registration.
   * @return {string} Each step and its status.
   */
  function reviewText_(form, r) {
    return (form.review?.steps || [])
      .map(function (s) {
        return s.label.en + ': ' + (r.review[s.id] || 'pending');
      })
      .join('  |  ');
  }

  /**
   * Makes the rows, tinted in turn, with the link cell left for its
   * formula.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The registrations in order.
   * @return {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>}}
   *     The rows and tints.
   */
  function registrationRows_(form, rows) {
    var out = { values: [], shades: [] };
    rows.forEach(function (r, i) {
      out.values.push([
        i + 1,
        r.name,
        r.code,
        r.phone,
        r.data.group || '',
        r.data.section || '',
        '',
        reviewText_(form, r)
      ]);
      var tint = SheetStyle.PALETTE.groups[i % 2].shades[0];
      out.shades.push(new Array(COLS_).fill(tint));
    });
    return out;
  }

  /**
   * Rebuilds the Registrations view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function build(form, ss) {
    var sh = SheetViewsLayout.freshView(ss, 'Registrations');
    SheetViewsLayout.paintHeader(sh, [
      'No.',
      'Name',
      'Code',
      'Phone',
      'Group',
      'Section',
      'Timetable',
      'Review'
    ]);
    SheetViewsLayout.setWidths(sh, WIDTHS_);
    var rows = ResponsesRepository.readResponses(form).sort(byGroup_);
    if (!rows.length) {
      SheetViewsLayout.emptyView(sh, COLS_, 'No registrations yet.');
      return;
    }
    var out = registrationRows_(form, rows);
    var first = SheetViewsLayout.FIRST_ROW;
    SheetViewsLayout.writeRows(sh, out.values, out.shades);
    rows.forEach(function (r, i) {
      if (!r.link) return;
      sh.getRange(i + first, LINK_COL_).setFormula(
        SheetViewsLayout.hyperlink(r.link, 'Open')
      );
    });
    sh.getRange(first, 2, rows.length, 1).setFontWeight('bold');
    sh.setRowHeights(first, rows.length, ROW_PX_);
    SheetViewsLayout.frameBlocks(
      sh,
      { cols: COLS_, first: first, last: rows.length + 1 },
      []
    );
  }

  return { build };
})();
