/**
 * Web app entry points. The browser sends every request as a POST with a
 * plain-text JSON body (no CORS preflight) and gets JSON back.
 */

function doGet() {
  return json({ ok: true, service: APP.name, version: APP.version });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: { code: 'bad_json', message: 'The request body must be JSON.' } });
  }
  var handler = API[String(req.action || '')];
  if (!handler) return json({ ok: false, error: { code: 'unknown_action', message: 'Unknown action.' } });
  try {
    return json(Object.assign({ ok: true }, handler(req)));
  } catch (err) {
    if (err && err.isApiError) return json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
    Logger.log('Unhandled error in ' + req.action + ': ' + (err && err.stack ? err.stack : err));
    return json({ ok: false, error: { code: 'server_error', message: 'Something went wrong on the server. Try again.' } });
  }
}
