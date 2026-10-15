/**
 * The time of a booking as the ticket's clock shows it: where the hands
 * stand at its start, and the part of the dial it covers. Loaded first of
 * the ticket parts; creates `App.ticket`, which the other parts add to.
 */
(function (App) {
  'use strict';

  /** The degrees of a full turn of a hand. */
  var FULL_TURN = 360;

  /** The hours on a clock face. */
  var CLOCK_HOURS = 12;

  /** The minutes the hour hand takes to go round once. */
  var DIAL_MINUTES = CLOCK_HOURS * 60;

  /** The dial a hand turns on, in degrees. */
  var DIAL = {
    HOURS: CLOCK_HOURS,
    HALF_TURN: FULL_TURN / 2,
    PER_HOUR: FULL_TURN / CLOCK_HOURS,
    PER_MINUTE: FULL_TURN / 60
  };

  /** A time such as "12:30" at the start of a slot. */
  var START = /(\d{1,2}):(\d{2})/;

  /** A slot such as "12:55 - 1:15": its start and its end. */
  var SPAN = /(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/;

  /**
   * Counts the minutes from 12 o'clock to a time on the dial.
   *
   * @param {string} hours The hour, as written.
   * @param {string} minutes The minutes, as written.
   * @return {number} The minutes.
   */
  function dialMinutes(hours, minutes) {
    return (+hours % CLOCK_HOURS) * 60 + +minutes;
  }

  /**
   * Gives the angles of the hands of a clock at the start of a time like
   * "12:30 - 12:50".
   *
   * @param {*} time The time.
   * @return {?Array<number>} The hour and the minute angle, or null when it
   *     has no time.
   */
  function handAngles(time) {
    var m = START.exec(String(time || ''));
    if (!m) return null;
    var hr = +m[1] % CLOCK_HOURS;
    var min = +m[2];
    return [hr * DIAL.PER_HOUR + min / 2, min * DIAL.PER_MINUTE];
  }

  /**
   * Gives the part of the dial a slot covers, in degrees clockwise from 12.
   * A slot of under an hour is marked on the minutes ("12:55 - 1:15" is 330
   * to 450); a longer one on the hours.
   *
   * @param {*} time The slot.
   * @return {?Array<number>} The angle it starts and ends at, or null when
   *     it has no length.
   */
  function slotArc(time) {
    var m = SPAN.exec(String(time || ''));
    if (!m) return null;
    var from = dialMinutes(m[1], m[2]);
    var to = dialMinutes(m[3], m[4]);
    var length = (to - from + DIAL_MINUTES) % DIAL_MINUTES;
    if (!length) return null;
    var start = (from % 60) * DIAL.PER_MINUTE;
    if (length < 60) return [start, start + length * DIAL.PER_MINUTE];
    return [from / 2, from / 2 + length / 2];
  }

  App.ticket = {
    DIAL: DIAL,
    handAngles: handAngles,
    slotArc: slotArc
  };
})(window.App);
