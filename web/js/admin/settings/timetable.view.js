/**
 * The timetable of a reservation form: pick the dates on a calendar, set
 * the hours once, and read the result as one row of slots for each day.
 * The state and its rules are in timetable.model.js; the calendar, the
 * hours and the rows of the days are drawn by their own parts.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var TT = A.tt;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Draws the head of the result: the days, the slots and the most
   * bookings they take.
   *
   * @param {!Object} t The timetable.
   * @return {!Element} The head.
   */
  function resultHead(t) {
    var slots = TT.slotCount(t);
    var counts = t.days.length
      ? h(
          'span',
          { class: 'muted-note' },
          A.plural(t.days.length, 'day', 'days') +
            ' · ' +
            A.plural(slots, 'slot', 'slots') +
            ' · ' +
            A.plural(slots * TT.capacity(t), 'booking', 'bookings') +
            ' at most'
        )
      : null;
    return h(
      'div',
      { class: 'tt-result-head' },
      h('h3', null, 'What students can book'),
      counts
    );
  }

  /**
   * Draws the banner about bookings whose day or time is no longer offered.
   *
   * @param {number} lost How many; more than 0.
   * @return {!Element} The banner.
   */
  function orphansBanner(lost) {
    return h(
      'div',
      { class: 'banner', role: 'alert', name: 'orphans' },
      A.plural(lost, 'booking is', 'bookings are') +
        ' on a day or a time that is no longer here. Put it back, or tell ' +
        (lost === 1 ? 'that team' : 'those teams') +
        ' to book again.'
    );
  }

  /**
   * Draws the result again: one row for each day, its slots as chips.
   *
   * @param {!Object} t The timetable.
   */
  function paintResult(t) {
    var box = t.resultBox;
    var lost = TT.orphans(t);
    ui.clear(box);
    box.appendChild(resultHead(t));
    if (lost) box.appendChild(orphansBanner(lost));
    if (!t.days.length) {
      box.appendChild(
        h(
          'div',
          { class: 'empty' },
          h('strong', null, 'No days yet.'),
          ' Click a date in the calendar to offer it. Each day gets the hours' +
            ' you set.'
        )
      );
      return;
    }
    t.days.forEach(function (d, i) {
      box.appendChild(TT.dayRow(t, d, i));
    });
    box.appendChild(
      h(
        'p',
        { class: 'muted-note' },
        'Click a time to switch it off for that day. A number on a time is' +
          ' how many teams booked it.'
      )
    );
  }

  /**
   * Draws the whole timetable again.
   *
   * @param {!Object} t The timetable.
   */
  function paint(t) {
    TT.paintCalendar(t);
    TT.paintHours(t);
    paintResult(t);
  }

  /**
   * Draws the card of the days: the calendar.
   *
   * @param {!Object} t The timetable.
   * @return {!Element} The card.
   */
  function daysCard(t) {
    return h(
      'section',
      { class: 'tt-card' },
      TT.stepHead(
        '1',
        'Days',
        'Click a date to offer it. Click it again to remove it.'
      ),
      t.calBox
    );
  }

  /**
   * Draws the timetable of a form.
   *
   * @param {!Object} f The form; its slots are filled in and changed in
   *     place.
   * @param {?Object=} taken The bookings of each saved slot, by
   *     Rules.slotKey(day id, time).
   * @return {!Object} `node`; `summary()`, the folded line of its panel;
   *     `problem()`, the first thing that stops a save, or ''; `slots()`,
   *     the timetable as the server stores it.
   */
  A.timetable = function (f, taken) {
    var t = TT.read(f, taken);
    t.view = TT.firstMonth(t);
    t.calBox = h('div', { class: 'tt-cal' });
    t.resultBox = h('div', { class: 'tt-result' });
    t.hoursNote = h('p', { class: 'muted-note', role: 'status' });
    t.paint = paint.bind(null, t);
    t.paintResult = paintResult.bind(null, t);
    var node = h(
      'div',
      { class: 'tt l-split' },
      h(
        'div',
        { class: 'l-side tt-setup l-stack' },
        daysCard(t),
        TT.hoursCard(t)
      ),
      h('div', { class: 'l-main' }, t.resultBox)
    );
    t.paint();

    return {
      node: node,
      summary: TT.summary.bind(null, t),
      problem: TT.problem.bind(null, t),
      slots: TT.slots.bind(null, t)
    };
  };
})(window.App);
