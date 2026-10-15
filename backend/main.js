/**
 * Web app entry points. The browser sends every request as a POST with a
 * plain-text JSON body (no CORS preflight) and gets JSON back.
 */

function doGet() {
  return ApiError.json({
    ok: true,
    service: Constants.APP.name,
    version: Constants.APP.version
  });
}

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
