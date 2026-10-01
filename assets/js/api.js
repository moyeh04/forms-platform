/** Talks to the Apps Script web app. Every call is a plain-text JSON POST (no CORS preflight). */
(function (App) {
  'use strict';

  function apiError(code, message, details) {
    var e = new Error(message);
    e.code = code;
    e.details = details;
    return e;
  }

  function endpoint() {
    var url = (window.APP_CONFIG || {}).API_URL || '';
    if (!url || url.indexOf('PASTE_') === 0) {
      throw apiError('not_configured', 'The website is not connected to the backend yet. Put the web app address in assets/js/config.js.');
    }
    return url;
  }

  async function call(payload) {
    var res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      if (e && e.code) throw e;
      throw apiError('network', 'Could not reach the server. Check your connection and try again.');
    }
    var data;
    try { data = await res.json(); } catch (e) { throw apiError('bad_response', 'The server sent an unexpected answer.'); }
    if (!data || !data.ok) {
      var er = (data && data.error) || {};
      throw apiError(er.code || 'server_error', er.message || 'Something went wrong. Try again.', er.details);
    }
    return data;
  }

  var PIN_KEY = 'fp_admin_pin';
  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function getPin() { var s = store(); return s ? s.getItem(PIN_KEY) || '' : ''; }
  function setPin(p) { var s = store(); if (s) { if (p) s.setItem(PIN_KEY, p); else s.removeItem(PIN_KEY); } }

  App.api = {
    call: call,
    /** Admin call: adds the PIN kept in this tab's session. */
    admin: function (action, extra) { return call(Object.assign({ action: action, admin: { pin: getPin() } }, extra || {})); },
    /** Viewer call: adds the private link token. */
    viewer: function (action, token, extra) { return call(Object.assign({ action: action, token: token }, extra || {})); },
    getPin: getPin,
    setPin: setPin,
    error: apiError
  };
})(window.App = window.App || {});
