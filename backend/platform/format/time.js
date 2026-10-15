/** The current time and date as ISO text. */

var Time = (function () {
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

  return { nowIso, todayIso: todayIso_ };
})();
