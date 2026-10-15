/** The error every handler throws and the JSON reply the web app sends. */

var ApiError = (function () {
  /**
   * Makes an error the router answers with its code instead of hiding it.
   *
   * @param {string} code What went wrong, for the page to translate.
   * @param {string} message The English sentence for the user.
   * @param {*=} details Anything the page needs to show the error.
   * @return {!Error} The error, marked `isApiError`.
   */
  function ApiError(code, message, details) {
    var e = new Error(message);
    e.isApiError = true;
    e.code = code;
    e.details = details;
    return e;
  }

  /**
   * Stops the request with an error the page shows.
   *
   * @param {string} code What went wrong, for the page to translate.
   * @param {string} message The English sentence for the user.
   * @param {*=} details Anything the page needs to show the error.
   */
  function fail(code, message, details) {
    throw ApiError(code, message, details);
  }

  /**
   * Turns a reply into the JSON text output the web app sends.
   *
   * @param {!Object} obj The reply.
   * @return {!ContentService.TextOutput} The output.
   */
  function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  return { json, fail };
})();
