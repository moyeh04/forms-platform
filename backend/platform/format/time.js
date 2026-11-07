/**
 * The current time and date as ISO text, instants some days away, and a
 * length of time as a clock reads it.
 */

var Time = (function () {
  /** The milliseconds in a day. */
  var DAY_MS_ = 86400000;

  /** Pads a clock part to two digits. */
  var TWO_DIGITS_ = '00';

  /**
   * Gives the current instant.
   *
   * @return {string} The instant in ISO form, in UTC.
   */
  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * Gives today's date in the time zone of the script.
   *
   * @return {string} The date as `yyyy-MM-dd`.
   */
  function todayIso_() {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  /**
   * Gives the time of day in the time zone of the script.
   *
   * @return {string} The time as `HH:mm`, on a 24-hour clock.
   */
  function clockNow_() {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }

  /**
   * Gives the instant some whole days after another.
   *
   * @param {number} fromMs The first instant, in milliseconds.
   * @param {number} days How many days later.
   * @return {string} The later instant in ISO form, in UTC.
   */
  function isoAfterDays_(fromMs, days) {
    return new Date(fromMs + days * DAY_MS_).toISOString();
  }

  /**
   * Writes a length of time as a clock reads it.
   *
   * @param {number} seconds The time, in whole seconds.
   * @return {string} The time as `HH:mm:ss`, such as `00:29:58`.
   */
  function clockText_(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    return [Math.floor(s / 60 / 60), Math.floor(s / 60) % 60, s % 60]
      .map(function (n) {
        return (TWO_DIGITS_ + n).slice(-2);
      })
      .join(':');
  }

  return {
    nowIso,
    clockText: clockText_,
    todayIso: todayIso_,
    clockNow: clockNow_,
    isoAfterDays: isoAfterDays_
  };
})();
