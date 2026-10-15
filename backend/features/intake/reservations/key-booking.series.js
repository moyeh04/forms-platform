/**
 * The weekly series of bookings of a registration form: the bookings so far,
 * and the title and timetable of the next one.
 */

var KeyBookingSeries = (function () {
  /** The days from one week of bookings to the next. */
  var WEEK_DAYS_ = 7;

  /**
   * Lists the reservations that are booked with the keys of a form, oldest
   * first.
   *
   * @param {!Object} source The registration form.
   * @return {!Array<!Object>} The reservations.
   */
  function bookingsOf_(source) {
    return FormsRepository.readForms()
      .filter(function (f) {
        return (
          f.type === FormType.RESERVATION &&
          !!f.keyBooking?.enabled &&
          f.keyBooking.source === source.id
        );
      })
      .sort(function (a, b) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      });
  }

  /**
   * Gives the title of the next booking: "Discussion - Week 3" gives
   * "Discussion - Week 4"; a title with no number gets " 2".
   *
   * @param {*} title The title of the newest booking.
   * @return {string} The next title.
   */
  function nextTitle_(title) {
    var m = /^(.*?)(\d+)(\D*)$/.exec(String(title));
    return m ? m[1] + (parseInt(m[2], 10) + 1) + m[3] : String(title) + ' 2';
  }

  /**
   * Names a day one week later: a day named after its date is named after
   * the new date, and a "Week 11" in a typed name becomes "Week 12".
   *
   * @param {!Object} d The day.
   * @param {string} date The new date.
   * @return {string} The new name.
   */
  function nextDayLabel_(d, date) {
    if (d.label === Rules.dayLabel(d.date)) return Rules.dayLabel(date);
    return String(d.label).replace(/(week\s*)(\d+)/i, function (_all, word, n) {
      return word + (parseInt(n, 10) + 1);
    });
  }

  /**
   * Gives the same timetable one week later. A day with no date is kept.
   *
   * @param {?Object} slots The timetable.
   * @return {!Object} The new timetable, cleaned.
   */
  function nextWeekSlots_(slots) {
    var days = (slots?.days || []).map(function (d) {
      if (!d.date) return { label: d.label, date: '', times: d.times.slice() };
      var date = Rules.shiftDate(d.date, WEEK_DAYS_);
      return {
        label: nextDayLabel_(d, date),
        date: date,
        times: d.times.slice()
      };
    });
    return SlotsRules.normalizeSlots({
      days: days,
      capacity: slots?.capacity,
      pattern: slots?.pattern
    });
  }

  return {
    bookingsOf: bookingsOf_,
    nextTitle: nextTitle_,
    nextWeekSlots: nextWeekSlots_
  };
})();
