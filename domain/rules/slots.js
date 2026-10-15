/**
 * The rules of reservation slots: the times of a day, the key and the room
 * left in a slot, the names of dated days, and the check of a chosen slot.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;

  /** The minutes of an hour. */
  var MINUTES_PER_HOUR = 60;

  /** The hours of a 12-hour clock face. */
  var CLOCK_HOURS = 12;

  /** A time of day as typed: H:MM or HH:MM. */
  var CLOCK_TIME = /^(\d{1,2}):(\d{2})$/;

  /** A date as stored: YYYY-MM-DD. */
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** The characters of a YYYY-MM-DD date. */
  var ISO_DATE_LENGTH = 10;

  /** The week days, Sunday first, as Date.getUTCDay counts them. */
  var WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];

  /** The short month names, January first. */
  var MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  /**
   * Reads a time of day as minutes after midnight.
   *
   * @param {*} hhmm The time, as H:MM or HH:MM.
   * @return {number} The minutes, or NaN when it is not a time.
   */
  function toMinutes(hhmm) {
    var m = String(hhmm).match(CLOCK_TIME);
    if (!m) return NaN;
    return parseInt(m[1], 10) * MINUTES_PER_HOUR + parseInt(m[2], 10);
  }

  /**
   * Writes a number of the clock with two digits.
   *
   * @param {number} n The number.
   * @return {string} The number, with a 0 before one digit.
   */
  function twoDigits(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Writes minutes after midnight as a time of day.
   *
   * @param {number} mins The minutes.
   * @param {string=} style '24h' for 24-hour time; otherwise 12-hour time
   *     without am or pm.
   * @return {string} The time.
   */
  function fmtTime(mins, style) {
    var h = Math.floor(mins / MINUTES_PER_HOUR);
    var mm = twoDigits(mins % MINUTES_PER_HOUR);
    if (style === '24h') return twoDigits(h) + ':' + mm;
    return (h % CLOCK_HOURS || CLOCK_HOURS) + ':' + mm;
  }

  /**
   * Builds the list of time slots for a day: generateSlots({start: '12:30',
   * end: '15:30', length: 20, gap: 5}) gives ["12:30 - 12:50",
   * "12:55 - 1:15", ...], in 12-hour style without am or pm.
   *
   * @param {{start: string, end: string, length: *, gap: *, style:
   *     (string|undefined)}} o The day's start and end, the minutes of a
   *     slot and between two slots, and the style of the times.
   * @return {!Array<string>} The slots, or none when the day is wrong.
   */
  function generateSlots(o) {
    var start = toMinutes(o.start);
    var end = toMinutes(o.end);
    var len = Number(o.length);
    var gap = Number(o.gap || 0);
    var wrong =
      Number.isNaN(start) || Number.isNaN(end) || !(len > 0) || gap < 0;
    if (wrong || end <= start) return [];
    var out = [];
    var t;
    for (t = start; t + len <= end; t += len + gap) {
      out.push(fmtTime(t, o.style) + ' - ' + fmtTime(t + len, o.style));
    }
    return out;
  }

  /**
   * Makes the key of a slot.
   *
   * @param {string} dayId The id of the day.
   * @param {string} time The time of the slot.
   * @return {string} The key, as "day|time".
   */
  function slotKey(dayId, time) {
    return dayId + '|' + time;
  }

  /**
   * Says how many more bookings a slot takes.
   *
   * @param {!Object} form The form, with its slot capacity.
   * @param {?Object<string, number>} counts The bookings of everyone else,
   *     by slot key.
   * @param {string} key The key of the slot.
   * @return {number} The bookings left, never below 0.
   */
  function slotRoom(form, counts, key) {
    var setup = form.slots || {};
    var taken = counts || {};
    var capacity = setup.capacity || 1;
    return Math.max(0, capacity - (taken[key] || 0));
  }

  /**
   * Reads a stored date as a time at midnight UTC, moved by some days.
   *
   * @param {*} date The date, as YYYY-MM-DD.
   * @param {number} days The days to move it by.
   * @return {?Date} The date, or null when it is not one.
   */
  function utcDate(date, days) {
    var m = ISO_DATE.exec(String(date || ''));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  }

  /**
   * Names a dated day when the admin does not type a name: "Sunday 14 Nov"
   * for 2027-11-14.
   *
   * @param {*} date The date, as YYYY-MM-DD.
   * @return {string} The name, or '' when it is not a date.
   */
  function dayLabel(date) {
    var d = utcDate(date, 0);
    if (!d) return '';
    return (
      WEEKDAYS[d.getUTCDay()] +
      ' ' +
      d.getUTCDate() +
      ' ' +
      MONTHS[d.getUTCMonth()]
    );
  }

  /**
   * Gives a date that many days later: shiftDate('2027-11-14', 7) is
   * '2027-11-21'.
   *
   * @param {*} date The date, as YYYY-MM-DD.
   * @param {number} days The days to add.
   * @return {string} The new date, or '' when it is not a date.
   */
  function shiftDate(date, days) {
    var d = utcDate(date, days);
    return d ? d.toISOString().slice(0, ISO_DATE_LENGTH) : '';
  }

  /**
   * Checks a chosen slot against the days and times of the form.
   *
   * @param {!Object} field The slot field.
   * @param {*} raw The choice, as `{day, time}`.
   * @param {{form: (!Object|undefined)}} ctx The form being filled in.
   * @return {!Object} `{ok: true, value: {day, time}}` or
   *     `{ok: false, error}`.
   */
  function validateSlot(field, raw, ctx) {
    var form = ctx.form || {};
    var setup = form.slots || {};
    var days = setup.days || [];
    var pick = raw || {};
    if (!pick.day || !pick.time) {
      return { ok: false, error: field.required === false ? 'ok' : 'required' };
    }
    var found = days.some(function (day) {
      return day.id === pick.day && (day.times || []).indexOf(pick.time) !== -1;
    });
    if (!found) return { ok: false, error: 'invalid_slot' };
    return { ok: true, value: { day: pick.day, time: pick.time } };
  }

  var api = {
    generateSlots: generateSlots,
    slotKey: slotKey,
    slotRoom: slotRoom,
    dayLabel: dayLabel,
    shiftDate: shiftDate,
    validateSlot: validateSlot
  };
  if (node) module.exports = api;
  root.RulesSlots = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
