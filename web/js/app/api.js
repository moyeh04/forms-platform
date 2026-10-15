/**
 * Talks to the Apps Script web app. Every call is a plain-text JSON POST,
 * so the browser sends no CORS preflight.
 */
(function (App) {
  'use strict';

  /** The session storage key of the admin PIN, kept for this tab only. */
  var PIN_KEY = 'fp_admin_pin';

  /** The message when the site was published without the backend URL. */
  var NOT_CONFIGURED =
    'The website is not connected to the backend yet. Set the GitHub ' +
    'Actions API_URL variable and publish through GitHub Actions. For ' +
    'local preview, run npm run dev.';

  /**
   * Makes the error a call throws.
   *
   * @param {string} code The error code, a key of the page's error text.
   * @param {string} message The English message.
   * @param {*=} details What the backend added.
   * @return {!Error} The error, with `code` and `details`.
   */
  function apiError(code, message, details) {
    var e = new Error(message);
    e.code = code;
    e.details = details;
    return e;
  }

  /**
   * Reads the backend URL the site was published with.
   *
   * @return {string} The URL.
   * @throws {!Error} 'not_configured' when there is none.
   */
  function endpoint() {
    var config = window.APP_CONFIG || {};
    var url = config.API_URL || '';
    if (!url || url.indexOf('PASTE_') === 0) {
      throw apiError('not_configured', NOT_CONFIGURED);
    }
    return url;
  }

  /**
   * Sends a request to the backend.
   *
   * @param {!Object} payload The request.
   * @return {!Promise<!Response>} The answer as it came.
   */
  async function send(payload) {
    try {
      return await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      if (e?.code) throw e;
      throw apiError(
        'network',
        'Could not reach the server. Check your connection and try again.'
      );
    }
  }

  /**
   * Calls the backend and checks its answer.
   *
   * @param {!Object} payload The request, with its `action`.
   * @return {!Promise<!Object>} The answer, when `ok` is true.
   */
  async function call(payload) {
    var res = await send(payload);
    var data;
    try {
      data = await res.json();
    } catch {
      throw apiError('bad_response', 'The server sent an unexpected answer.');
    }
    if (data?.ok) return data;
    var er = data?.error || {};
    throw apiError(
      er.code || 'server_error',
      er.message || 'Something went wrong. Try again.',
      er.details
    );
  }

  /**
   * Finds the session storage, which a locked-down browser may refuse.
   *
   * @return {?Storage} The storage, or null.
   */
  function store() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  /**
   * Reads the admin PIN kept in this tab.
   *
   * @return {string} The PIN, or ''.
   */
  function getPin() {
    var s = store();
    return s ? s.getItem(PIN_KEY) || '' : '';
  }

  /**
   * Keeps the admin PIN in this tab, or forgets it.
   *
   * @param {string} p The PIN, or '' to forget it.
   */
  function setPin(p) {
    var s = store();
    if (!s) return;
    if (p) s.setItem(PIN_KEY, p);
    else s.removeItem(PIN_KEY);
  }

  /**
   * Makes an admin call, with the PIN kept in this tab.
   *
   * @param {string} action The action.
   * @param {?Object=} extra The other fields of the request.
   * @return {!Promise<!Object>} The answer.
   */
  function admin(action, extra) {
    var base = { action: action, admin: { pin: getPin() } };
    return call(Object.assign(base, extra || {}));
  }

  /**
   * Makes a call with the private link token of an instructor or client.
   *
   * @param {string} action The action.
   * @param {string} token The token.
   * @param {?Object=} extra The other fields of the request.
   * @return {!Promise<!Object>} The answer.
   */
  function viewer(action, token, extra) {
    return call(Object.assign({ action: action, token: token }, extra || {}));
  }

  App.api = {
    call: call,
    admin: admin,
    viewer: viewer,
    getPin: getPin,
    setPin: setPin,
    error: apiError
  };
})(window.App);
