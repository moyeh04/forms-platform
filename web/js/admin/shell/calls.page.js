/**
 * The dashboard's calls to the backend and what it tells the admin when one
 * fails.
 */
(function (App) {
  'use strict';

  var A = App.admin;

  /**
   * Calls an admin action. A wrong PIN signs this window out. A lock is
   * passing: the PIN is kept and the message says to wait.
   *
   * @param {string} action The action.
   * @param {!Object=} extra What it is given.
   * @return {!Promise<!Object>} Its answer.
   */
  A.call = async function (action, extra) {
    try {
      return await App.api.admin(action, extra);
    } catch (e) {
      if (e.code === 'bad_pin') {
        App.api.setPin('');
        A.start();
      }
      throw e;
    }
  };

  /**
   * Says what to tell the admin about a failed call.
   *
   * @param {?Object} e The error.
   * @return {string} The message, with the names of the fields refused.
   */
  A.message = function (e) {
    var msg = e?.message || 'Something went wrong.';
    if (e && e.code === 'invalid' && e.details) {
      msg += ' (' + Object.keys(e.details).join(', ') + ')';
    }
    return msg;
  };

  /**
   * Tells the admin a call failed.
   *
   * @param {?Object} e The error.
   */
  A.fail = function (e) {
    App.ui.toast(A.message(e), 'err');
  };

  /**
   * Runs a button action: disables the button, reports errors, always
   * enables it again.
   *
   * @param {?Element} btn The button.
   * @param {function(): !Promise} fn The action.
   * @return {!Promise} Its answer, or undefined when it failed.
   */
  A.busy = async function (btn, fn) {
    if (btn) btn.disabled = true;
    try {
      return await fn();
    } catch (e) {
      A.fail(e);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
})(window.App);
