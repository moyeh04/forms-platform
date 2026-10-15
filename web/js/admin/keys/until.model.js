/**
 * The dates keys and private links work until: how a date is written, the
 * end of a picked day, and where a key ends once it is given more time.
 */
(function (App) {
  'use strict';

  var A = App.admin;

  /** The milliseconds of a second and of a day. */
  var SECOND_MS = 1000;
  var DAY_MS = 24 * 60 * 60 * SECOND_MS;

  /** The last minute of a day, which a picked end date runs to. */
  var END_OF_DAY = { HOUR: 23, MINUTE: 59 };

  A.DAY_MS = DAY_MS;

  /**
   * Writes a date people read at a glance, such as "14 Oct 2026".
   *
   * @param {*} iso The moment.
   * @return {string} The date, or '' when it is not one.
   */
  A.day = function (iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  /**
   * Says whether an end date has passed.
   *
   * @param {string} iso The end, or '' for none.
   * @return {boolean} True when it has.
   */
  A.ended = function (iso) {
    return !!(iso && Date.parse(iso) < Date.now());
  };

  /**
   * Gives the end of a picked calendar day, in the admin's time zone.
   *
   * @param {string} value The day, as YYYY-MM-DD.
   * @return {string} The moment it ends.
   */
  A.endOfDay = function (value) {
    var p = String(value).split('-').map(Number);
    return new Date(
      p[0],
      p[1] - 1,
      p[2],
      END_OF_DAY.HOUR,
      END_OF_DAY.MINUTE
    ).toISOString();
  };

  /**
   * Writes a date as a date box takes it.
   *
   * @param {!Date} d The date.
   * @return {string} The date, as YYYY-MM-DD in the admin's time zone.
   */
  A.dateValue = function (d) {
    return (
      d.getFullYear() +
      '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + d.getDate()).slice(-2)
    );
  };

  /**
   * Gives where a key ends after a choice: time is added to the later of
   * now and its end.
   *
   * @param {string} current Where it ends now.
   * @param {?Object} choice `{days}`, `{until}` or `{none: true}`.
   * @return {string} The new end, or '' for none.
   */
  A.extendedEnd = function (current, choice) {
    if (!choice) return '';
    if (choice.until) return choice.until;
    if (choice.none) return '';
    return new Date(
      Math.max(Date.now(), Date.parse(current) || 0) + choice.days * DAY_MS
    ).toISOString();
  };
})(window.App);
