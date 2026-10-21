/**
 * The days of a reservation as a month calendar: a dated booking day is a
 * date the student can pick, with the places it has left, and every other
 * date is plain. The times of the picked day are drawn under it by
 * slots.view.js.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;

  /** A date as the form stores it, such as 2026-11-14. */
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** The days in a week. */
  var WEEK = 7;

  /** The weekday a week starts on: Saturday, as the university week. */
  var WEEK_START = 6;

  /** A Saturday, the first column of the calendar. */
  var A_SATURDAY = '2000-01-01';

  /** The characters of a month, YYYY-MM, at the start of a date. */
  var MONTH_LENGTH = 7;

  /** The characters of a date, YYYY-MM-DD, at the start of ISO text. */
  var DATE_LENGTH = 10;

  /** The size of the month arrows, in pixels. */
  var ARROW_SIZE = 18;

  /**
   * Reads a stored date as a time at midnight UTC.
   *
   * @param {*} date The date, as YYYY-MM-DD.
   * @return {?Date} The date, or null when it is not one.
   */
  function utc(date) {
    var m = ISO_DATE.exec(String(date || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }

  /**
   * Writes a date in the language of the page.
   *
   * @param {!Date} d The date, at midnight UTC.
   * @param {!Object} o What to write of it, as toLocaleDateString takes.
   * @return {string} The text, or '' when the browser cannot write it.
   */
  function dateText(d, o) {
    var locale = App.i18n.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
    try {
      return d.toLocaleDateString(
        locale,
        Object.assign({ timeZone: 'UTC' }, o)
      );
    } catch {
      return '';
    }
  }

  /**
   * Writes a date as the form stores it.
   *
   * @param {!Date} d The date, at midnight UTC.
   * @return {string} The date, as YYYY-MM-DD.
   */
  function isoOf(d) {
    return d.toISOString().slice(0, DATE_LENGTH);
  }

  /**
   * Gives the month of a date as a key, such as 2026-11.
   *
   * @param {string} date The date, as YYYY-MM-DD.
   * @return {string} The month.
   */
  function monthOf(date) {
    return date.slice(0, MONTH_LENGTH);
  }

  /**
   * Indexes the days by their date. The timetable gives each date one
   * day.
   *
   * @param {!Array<!Object>} days The days of the form.
   * @return {!Object<string, !Object>} The days, by date.
   */
  function byDate(days) {
    var out = {};
    days.forEach(function (d) {
      if (utc(d.date) && !out[d.date]) out[d.date] = d;
    });
    return out;
  }

  /**
   * Lists the months from the first booking day to the last.
   *
   * @param {!Array<string>} dates The dates, in any order.
   * @return {!Array<string>} The months, as YYYY-MM.
   */
  function monthsOf(dates) {
    var sorted = dates.slice().sort();
    var at = utc(monthOf(sorted[0]) + '-01');
    var last = monthOf(sorted[sorted.length - 1]);
    var out = [monthOf(isoOf(at))];
    while (out[out.length - 1] < last) {
      at.setUTCMonth(at.getUTCMonth() + 1);
      out.push(monthOf(isoOf(at)));
    }
    return out;
  }

  /**
   * Draws the weekday names, starting on Saturday.
   *
   * @return {!Array<!Element>} A head cell for each weekday.
   */
  function weekdays() {
    var d = utc(A_SATURDAY);
    var out = [];
    while (out.length < WEEK) {
      out.push(
        h(
          'span',
          { class: 'cal-wd', 'aria-hidden': 'true' },
          dateText(d, { weekday: 'short' })
        )
      );
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  /**
   * Draws a booking day the student can pick, with the places it has
   * left; a full day cannot be picked unless it is the one picked.
   *
   * @param {!Object} c The calendar: `cur`, `roomOf`, `choose`.
   * @param {!Object} day The day.
   * @param {string} text The number of the date.
   * @return {!Element} The button.
   */
  function dayButton(c, day, text) {
    var left = c.roomOf(day);
    var picked = c.cur.day === day.id;
    var note = left ? t('slotsLeft', { n: left }) : t('slotFull');
    return h(
      'button',
      {
        type: 'button',
        class: 'cal-date is-day' + (left || picked ? '' : ' is-full'),
        name: 'day-' + day.id,
        disabled: !(left || picked),
        'aria-pressed': picked ? 'true' : 'false',
        'aria-label': day.label + ', ' + note,
        title: day.label,
        onclick: function () {
          c.choose({ day: day.id, time: '' });
        }
      },
      h('span', { class: 'cal-num', dir: 'auto' }, text),
      h('small', { class: 'cal-left' }, note)
    );
  }

  /**
   * Draws one date of the month: a booking day, or its plain number.
   *
   * @param {!Object} c The calendar.
   * @param {string} date The date, as YYYY-MM-DD.
   * @return {!Element} The cell.
   */
  function dateCell(c, date) {
    var num = String(utc(date).getUTCDate());
    var day = c.days[date];
    return day ? dayButton(c, day, num) : h('span', { class: 'cal-date' }, num);
  }

  /**
   * Draws the dates of a month, with blanks before the first so each date
   * sits under its weekday.
   *
   * @param {!Object} c The calendar.
   * @param {string} month The month, as YYYY-MM.
   * @return {!Array<!Element>} The cells.
   */
  function dates(c, month) {
    var d = utc(month + '-01');
    var out = [];
    var blanks = (d.getUTCDay() - WEEK_START + WEEK) % WEEK;
    while (out.length < blanks) out.push(h('span', { class: 'cal-blank' }));
    while (monthOf(isoOf(d)) === month) {
      out.push(dateCell(c, isoOf(d)));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  /**
   * Draws an arrow to the month before or after, or a blank where there
   * is none.
   *
   * @param {!Object} c The calendar.
   * @param {number} step -1 or 1.
   * @return {!Element} The arrow.
   */
  function arrow(c, step) {
    var to = c.months[c.at + step];
    var back = step < 0;
    if (!to) return h('span', { class: 'cal-nav' });
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn cal-nav' + (back ? ' cal-prev' : ''),
        name: back ? 'month-prev' : 'month-next',
        'aria-label': dateText(utc(to + '-01'), {
          month: 'long',
          year: 'numeric'
        }),
        onclick: function () {
          c.show(to);
        }
      },
      App.ui.icon('arrow', ARROW_SIZE)
    );
  }

  /**
   * Picks the month the calendar opens on: the month of the picked day,
   * else of the first day with places left, else the first month.
   *
   * @param {!Object} c The calendar.
   * @return {string} The month.
   */
  function openMonth(c) {
    var dates = Object.keys(c.days).sort();
    var picked = dates.filter(function (d) {
      return c.days[d].id === c.cur.day;
    })[0];
    var free = dates.filter(function (d) {
      return c.roomOf(c.days[d]);
    })[0];
    return monthOf(picked || free || dates[0]);
  }

  /**
   * Draws the month calendar of the dated days.
   *
   * @param {!Object} c The calendar.
   * @return {!Element} The calendar.
   */
  function monthView(c) {
    c.months = monthsOf(Object.keys(c.days));
    var month = c.view.month;
    if (c.months.indexOf(month) < 0) month = openMonth(c);
    c.at = c.months.indexOf(month);
    var node = h('div', { class: 'cal' });
    /**
     * Shows another month.
     *
     * @param {string} to The month.
     */
    c.show = function (to) {
      c.view.month = to;
      node.replaceWith(monthView(c));
    };
    node.append(
      h(
        'div',
        { class: 'cal-head' },
        arrow(c, -1),
        h(
          'strong',
          { class: 'cal-month', 'aria-live': 'polite' },
          dateText(utc(month + '-01'), { month: 'long', year: 'numeric' })
        ),
        arrow(c, 1)
      ),
      h('div', { class: 'cal-grid' }, weekdays().concat(dates(c, month)))
    );
    return node;
  }

  /**
   * Draws the booking days as a month calendar.
   *
   * @param {!Object} o `days` of the form, `cur` the slot picked now,
   *     `roomOf(day)` the places a day has left, `choose(slot)` keeps a
   *     pick, and `view`, an object kept between draws that holds the
   *     month shown.
   * @return {!Element} The days.
   */
  P.slotCalendar = function (o) {
    var c = Object.assign({}, o, { days: byDate(o.days) });
    return h(
      'div',
      { class: 'slot-days', role: 'group', 'aria-label': t('slotDay') },
      Object.keys(c.days).length ? monthView(c) : null
    );
  };
})(window.App);
