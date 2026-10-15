/**
 * The Bookings view: every booking in timetable order, each day a block
 * with its label merged down the side.
 */

var SheetViewsBookings = (function () {
  /** The width of each column before the teammates, in pixels. */
  var COLUMN_PX_ = {
    day: 190,
    time: 140,
    leader: 300,
    code: 110,
    phone: 130,
    project: 280
  };

  /** The widths in column order. */
  var WIDTHS_ = Object.values(COLUMN_PX_);

  /** The width of the teammates column, in pixels. */
  var TEAMMATES_PX_ = 240;

  /** The height of a booking row, in pixels. */
  var ROW_PX_ = 32;

  /** The column of the team leader, which is bold. */
  var LEADER_COL_ = 3;

  /** The column of the code; it and the phone are centred. */
  var CODE_COL_ = 4;

  /** Where a day or time missing from the timetable sorts: last. */
  var UNKNOWN_ = 999;

  /** How far one day sorts from the next, more than any day's times. */
  var DAY_WEIGHT_ = 1000;

  /**
   * Gives the place of a booking in the timetable.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The booking.
   * @return {number} Its place; smaller comes first.
   */
  function order_(form, r) {
    var days = form.slots?.days || [];
    var p = SlotsRules.slotParts(form, r.slot);
    var di = days.indexOf(p.day);
    var ti = p.day ? p.day.times.indexOf(p.time) : 0;
    return (di < 0 ? UNKNOWN_ : di) * DAY_WEIGHT_ + (ti < 0 ? UNKNOWN_ : ti);
  }

  /**
   * Reads the bookings in timetable order.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} The registrations that hold a slot.
   */
  function bookings_(form) {
    return ResponsesRepository.readResponses(form)
      .filter(function (r) {
        return r.slot;
      })
      .sort(function (a, b) {
        return order_(form, a) - order_(form, b);
      });
  }

  /**
   * Makes the row of one booking, with the day cell left for the label.
   *
   * @param {!Object} p The slot of the booking, from `SlotsRules.slotParts`.
   * @param {!Object} r The booking.
   * @param {boolean} withMembers Whether the view has a teammates column.
   * @return {!Array<*>} The row.
   */
  function bookingRow_(p, r, withMembers) {
    var row = ['', p.time, r.name, r.code, r.phone, r.title];
    if (withMembers) {
      row.push(
        (r.data.members || [])
          .map(function (member) {
            return member.name;
          })
          .filter(Boolean)
          .join(', ')
      );
    }
    return row;
  }

  /**
   * Makes the rows, their tints and the block of each day.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The bookings in order.
   * @param {boolean} withMembers Whether the view has a teammates column.
   * @return {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>,
   *     blocks: !Array<!Object>}} The rows, tints and blocks.
   */
  function dayRows_(form, rows, withMembers) {
    var out = { values: [], shades: [], blocks: [] };
    var current = null;
    rows.forEach(function (r) {
      var p = SlotsRules.slotParts(form, r.slot);
      if (!current || current.dayId !== p.dayId) {
        current = {
          dayId: p.dayId,
          label: p.day ? p.day.label : p.dayId,
          start: out.values.length + SheetViewsLayout.FIRST_ROW,
          length: 0,
          style: SheetStyle.PALETTE.groups[out.blocks.length % 2]
        };
        out.blocks.push(current);
      }
      var tint = current.style.shades[current.length % 2];
      current.length++;
      out.values.push(bookingRow_(p, r, withMembers));
      var row = new Array(WIDTHS_.length + (withMembers ? 1 : 0)).fill(tint);
      row[0] = current.style.solid;
      out.shades.push(row);
    });
    return out;
  }

  /**
   * Writes the rows of the bookings, labels each day and frames it.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {{values: !Array<!Array<*>>, shades: !Array<!Array<string>>,
   *     blocks: !Array<!Object>}} rows The rows of `dayRows_`.
   */
  function writeDays_(sh, rows) {
    var first = SheetViewsLayout.FIRST_ROW;
    var n = rows.values.length;
    SheetViewsLayout.writeRows(sh, rows.values, rows.shades);
    sh.getRange(first, LEADER_COL_, n, 1).setFontWeight('bold');
    sh.getRange(first, 2, n, 1).setHorizontalAlignment('center');
    sh.getRange(first, CODE_COL_, n, 2).setHorizontalAlignment('center');
    sh.setRowHeights(first, n, ROW_PX_);
    rows.blocks.forEach(function (b) {
      SheetViewsLayout.mergedLabel(
        sh,
        { row: b.start, col: 1, length: b.length },
        { value: b.label, formula: '', fill: b.style.solid }
      );
    });
    SheetViewsLayout.frameBlocks(
      sh,
      { cols: WIDTHS_.length, first: first, last: n + 1 },
      rows.blocks
    );
  }

  /**
   * Rebuilds the Bookings view.
   *
   * @param {!Object} form The form as it validates.
   * @param {!SpreadsheetApp.Spreadsheet} ss The form's spreadsheet.
   */
  function build(form, ss) {
    var sh = SheetViewsLayout.freshView(ss, 'Bookings');
    var membersField = Rules.fieldByRole(form, 'members');
    var withMembers = !!(membersField && membersField.enabled !== false);
    var headers = ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project'];
    if (withMembers) headers.push('Teammates');
    SheetViewsLayout.paintHeader(sh, headers);
    SheetViewsLayout.setWidths(
      sh,
      WIDTHS_.concat(withMembers ? [TEAMMATES_PX_] : [])
    );
    var rows = bookings_(form);
    if (!rows.length) {
      SheetViewsLayout.emptyView(sh, WIDTHS_.length, 'No bookings yet.');
      return;
    }
    writeDays_(sh, dayRows_(form, rows, withMembers));
  }

  return { build };
})();
