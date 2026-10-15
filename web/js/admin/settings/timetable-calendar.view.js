/**
 * The month calendar of the timetable: a click on a date adds it to the
 * timetable, another click removes it. Dates with bookings are marked.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var TT = A.tt;
  var ui = App.ui;
  var h = ui.h;
  var Rules = window.Rules;

  /** The teaching week starts on Saturday. */
  var WEEK = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  /** How far Saturday is from Sunday, the first day of a Date week. */
  var SATURDAY_SHIFT = 1;

  /** Where the year and the month sit in YYYY-MM-DD. */
  var ISO = { YEAR_END: 4, MONTH_START: 5, MONTH_END: 7 };

  var MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  /**
   * Picks the month the calendar opens on: the month of the last dated
   * day, or this month.
   *
   * @param {!Object} t The timetable.
   * @return {{y: number, m: number}} The year and the month, from 0.
   */
  TT.firstMonth = function (t) {
    var dated = t.days.filter(function (d) {
      return d.date;
    });
    var start = dated.pop()?.date || TT.today();
    return {
      y: +start.slice(0, ISO.YEAR_END),
      m: +start.slice(ISO.MONTH_START, ISO.MONTH_END) - 1
    };
  };

  /**
   * Draws one date of the month.
   *
   * @param {!Object} t The timetable.
   * @param {number} n The day of the month.
   * @return {!Element} The button.
   */
  function dateCell(t, n) {
    var date = TT.iso(t.view.y, t.view.m, n);
    var day = t.days.filter(function (d) {
      return d.date === date;
    })[0];
    var has = day ? TT.bookedOn(t, day) : 0;
    return h(
      'button',
      {
        type: 'button',
        class:
          'tt-cal-day' +
          (date === TT.today() ? ' today' : '') +
          (has ? ' has-bookings' : ''),
        name: 'cal-' + date,
        'aria-pressed': day ? 'true' : 'false',
        'aria-label': Rules.dayLabel(date) + (day ? ', in the timetable' : ''),
        title: has
          ? A.plural(has, 'booking', 'bookings') + ' on this day'
          : null,
        onclick: function () {
          TT.toggleDate(t, date);
          t.paint();
        }
      },
      String(n)
    );
  }

  /**
   * Draws the gaps before the first date and the dates of the month.
   *
   * @param {!Object} t The timetable.
   * @return {!Array<!Element>} The cells.
   */
  function monthCells(t) {
    var first = new Date(Date.UTC(t.view.y, t.view.m, 1));
    var lead = (first.getUTCDay() + SATURDAY_SHIFT) % WEEK.length;
    var count = new Date(Date.UTC(t.view.y, t.view.m + 1, 0)).getUTCDate();
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push(h('span', { class: 'tt-cal-gap' }));
    for (i = 1; i <= count; i++) cells.push(dateCell(t, i));
    return cells;
  }

  /**
   * Draws a button that turns the month.
   *
   * @param {!Object} t The timetable.
   * @param {number} by -1 for the month before, 1 for the month after.
   * @return {!Element} The button.
   */
  function monthButton(t, by) {
    var back = by < 0;
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: back ? 'cal-prev' : 'cal-next',
        'aria-label': back ? 'Month before' : 'Month after',
        onclick: function () {
          var d = new Date(Date.UTC(t.view.y, t.view.m + by, 1));
          t.view = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
          TT.paintCalendar(t);
        }
      },
      back ? '‹' : '›'
    );
  }

  /**
   * Draws the calendar of the month in view again.
   *
   * @param {!Object} t The timetable: `view` and `calBox`.
   */
  TT.paintCalendar = function (t) {
    ui.clear(t.calBox);
    t.calBox.appendChild(
      h(
        'div',
        { class: 'tt-cal-head' },
        monthButton(t, -1),
        h(
          'strong',
          { class: 'tt-cal-month', 'aria-live': 'polite' },
          MONTHS[t.view.m] + ' ' + t.view.y
        ),
        monthButton(t, 1)
      )
    );
    t.calBox.appendChild(
      h(
        'div',
        { class: 'tt-cal-grid' },
        WEEK.map(function (w) {
          return h('span', { class: 'tt-cal-dow' }, w);
        }),
        monthCells(t)
      )
    );
  };
})(window.App);
