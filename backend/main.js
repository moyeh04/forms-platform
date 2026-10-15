/**
 * Web app entry points. The browser sends every request as a POST with a
 * plain-text JSON body (no CORS preflight) and gets JSON back.
 */

/**
 * Answers a GET with the service name and version, so a browser or a
 * monitor can see the deployment is up.
 *
 * @return {!ContentService.TextOutput} The JSON answer.
 */
function doGet() {
  return ApiError.json({
    ok: true,
    service: Constants.APP.name,
    version: Constants.APP.version
  });
}

/**
 * Answers an API request: parses the body and hands it to the routes.
 *
 * @param {!Object} e The request event; `postData.contents` holds the JSON
 *     body.
 * @return {!ContentService.TextOutput} The JSON answer.
 */
function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return ApiError.json({
      ok: false,
      error: { code: 'bad_json', message: 'The request body must be JSON.' }
    });
  }
  return ApiError.json(Routes.reply(req));
}
