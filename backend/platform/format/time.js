/** The current time and date as ISO text, and instants some days away. */

var Time = (function () {
  /** The milliseconds in a day. */
  var DAY_MS_ = 86400000;

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
   * Gives the instant some whole days after another.
   *
   * @param {number} fromMs The first instant, in milliseconds.
   * @param {number} days How many days later.
   * @return {string} The later instant in ISO form, in UTC.
   */
  function isoAfterDays_(fromMs, days) {
    return new Date(fromMs + days * DAY_MS_).toISOString();
  }

  return { nowIso, todayIso: todayIso_, isoAfterDays: isoAfterDays_ };
})();
