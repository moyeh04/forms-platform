/** Copying values and reading JSON text safely. */

var Json = (function () {
  /**
   * Copies a plain value deeply.
   *
   * @param {*} o The value; it must survive JSON.
   * @return {*} The copy, or undefined for undefined.
   */
  function clone(o) {
    return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  }

  /**
   * Reads JSON text from a cell, which may be empty or broken.
   *
   * @param {*} text The text.
   * @param {*} fallback What an empty or unreadable text gives.
   * @return {*} The value the text holds, or the fallback.
   */
  function parseJson(text, fallback) {
    if (text === '' || text === null || text === undefined) return fallback;
    try {
      return JSON.parse(text);
    } catch (e) {
      return fallback;
    }
  }

  return { parseJson, clone };
})();
