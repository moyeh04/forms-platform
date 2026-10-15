/** The error every handler throws and the JSON reply the web app sends. */

var ApiError = (function () {
  function ApiError(code, message, details) {
    var e = new Error(message);
    e.isApiError = true;
    e.code = code;
    e.details = details;
    return e;
  }

  function fail(code, message, details) {
    throw ApiError(code, message, details);
  }

  function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  return { json, fail };
})();
