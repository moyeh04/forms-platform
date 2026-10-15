/**
 * The print tab of one day of reservations: each booking in timetable
 * order, with its teammates when the form asks for them and an empty
 * column to sign.
 */

var PrintReservations = (function () {
  /** The width of each column before the teammates, in pixels. */
  var COLUMN_PX_ = {
    number: 60,
    time: 150,
    leader: 300,
    code: 110,
    project: 260
  };

  /** The widths in column order. */
  var WIDTHS_ = Object.values(COLUMN_PX_);

  /** The width of the teammates column, in pixels. */
  var TEAMMATES_PX_ = 240;

  /** The width of the signature column, in pixels. */
  var SIGNATURE_PX_ = 160;

  /** The height of a booking row, in pixels. */
  var ROW_PX_ = 38;

  /** The column of the code, which is centred. */
  var CODE_COL_ = 4;

  /**
   * Finds a day of the timetable.
   *
   * @param {!Object} vform The form as the rules read it.
   * @param {string} dayId The id of the day.
   * @return {!Object} The day.
   */
  function requireDay_(vform, dayId) {
    var days = vform.slots?.days || [];
    var day = days.filter(function (d) {
      return d.id === dayId;
    })[0];
    if (!day) {
      ApiError.fail('day_not_found', 'That day is not in the timetable.');
    }
    return day;
  }

  /**
   * Groups the bookings of one day by their time.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as the rules read it.
   * @param {string} dayId The id of the day.
   * @return {!Object<string, !Array<!Object>>} The bookings by time.
   */
  function bookingsByTime_(form, vform, dayId) {
    var byTime = {};
    ResponsesRepository.readResponses(form).forEach(function (r) {
      var p = SlotsRules.slotParts(vform, r.slot);
      if (p.dayId !== dayId) return;
      byTime[p.time] = byTime[p.time] || [];
      byTime[p.time].push(r);
    });
    return byTime;
  }

  /**
   * Makes the row of one booking, with its number left empty.
   *
   * @param {string} time The time of the slot.
   * @param {!Object} r The booking.
   * @param {boolean} withMembers Whether the tab has a teammates column.
   * @return {!Array<*>} The row.
   */
  function bookingRow_(time, r, withMembers) {
    var row = ['', time, r.name, r.code, r.title];
    if (withMembers) {
      row.push(
        (r.data.members || [])
          .map(function (m) {
            return m.name;
          })
          .filter(Boolean)
          .join(', ')
      );
    }
    row.push('');
    return row;
  }

  /**
   * Makes the row of a free time, with its number left empty.
   *
   * @param {string} time The time of the slot.
   * @param {number} cols How many columns the tab has.
   * @return {!Array<string>} The row.
   */
  function emptyRow_(time, cols) {
    var row = new Array(cols).fill('');
    row[1] = time;
    return row;
  }

  /**
   * Makes the numbered rows of a day, in timetable order.
   *
   * @param {!Object} day The day.
   * @param {!Object<string, !Array<!Object>>} byTime The bookings by time.
   * @param {{withMembers: boolean, includeEmpty: boolean}} opts Whether
   *     the tab has a teammates column and shows free times.
   * @return {!Array<!Array<*>>} The rows.
   */
  function dayRows_(day, byTime, opts) {
    var values = [];
    var cols = WIDTHS_.length + (opts.withMembers ? 2 : 1);
    day.times.forEach(function (t) {
      var list = byTime[t] || [];
      if (!list.length && opts.includeEmpty) values.push(emptyRow_(t, cols));
      list.forEach(function (r) {
        values.push(bookingRow_(t, r, opts.withMembers));
      });
    });
    values.forEach(function (v, i) {
      v[0] = i + 1;
    });
    return values;
  }

  /**
   * Writes the rows of a day under the header and frames them.
   *
   * @param {!SpreadsheetApp.Sheet} sh The tab.
   * @param {!Array<!Array<*>>} values The rows.
   * @param {number} cols How many columns the tab has.
   */
  function writeRows_(sh, values, cols) {
    var first = PrintLayout.FIRST_ROW;
    sh.getRange(first, 1, values.length, cols)
      .setValues(values)
      .setFontFamily(SheetStyle.PALETTE.font)
      .setFontSize(PrintLayout.BODY_FONT)
      .setVerticalAlignment('middle');
    sh.getRange(first, 1, values.length, 2).setHorizontalAlignment('center');
    sh.getRange(first, CODE_COL_, values.length, 1).setHorizontalAlignment(
      'center'
    );
    sh.setRowHeights(first, values.length, ROW_PX_);
    PrintLayout.frame(
      sh.getRange(PrintLayout.HEADER_ROW, 1, values.length + 1, cols),
      PrintLayout.BLACK
    );
  }

  /**
   * Rebuilds the print tab of one day of reservations.
   *
   * @param {!Object} form The form.
   * @param {string} dayId The id of the day.
   * @param {boolean} includeEmpty Whether free times get an empty row.
   * @return {{sheetName: string, gid: number, count: number,
   *     landscape: boolean}} The tab.
   */
  function printDay(form, dayId, includeEmpty) {
    var vform = FormsPublic.validationForm(form);
    var day = requireDay_(vform, dayId);
    var withMembers = Rules.fieldByRole(vform, 'members').enabled !== false;
    var values = dayRows_(day, bookingsByTime_(form, vform, dayId), {
      withMembers: withMembers,
      includeEmpty: includeEmpty
    });
    var ss = SpreadsheetApp.openById(form.sheetId);
    var sh = SheetViewsLayout.freshView(ss, PrintLayout.sheetName(day.label));
    var headers = ['No.', 'Time', 'Team leader', 'Code', 'Project'];
    if (withMembers) headers.push('Teammates');
    headers.push('Signature');
    var date = day.date ? '  (' + day.date + ')' : '';
    PrintLayout.paintHeader(
      sh,
      form.title + '  -  ' + day.label + date,
      headers
    );
    PrintLayout.setWidths(
      sh,
      WIDTHS_.concat(withMembers ? [TEAMMATES_PX_] : [], [SIGNATURE_PX_])
    );
    if (values.length) writeRows_(sh, values, headers.length);
    else {
      PrintLayout.emptyNote(sh, headers.length, 'No bookings for this day.');
    }
    return PrintLayout.printed(sh, values.length);
  }

  return { printDay };
})();
