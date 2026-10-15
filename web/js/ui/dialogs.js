/**
 * The messages that sit over a page: a short toast that goes away by
 * itself, and a confirmation dialog that waits for an answer.
 */
(function (App) {
  'use strict';

  var h = App.ui.h;

  /** How long a toast stays, in milliseconds. */
  var TOAST_MS = 3600;

  /**
   * Finds the box the toasts go in, and makes it the first time.
   *
   * @return {!Element} The box, read aloud politely by screen readers.
   */
  function toastHost() {
    var host = document.getElementById('toasts');
    if (host) return host;
    host = h('div', {
      id: 'toasts',
      class: 'toasts',
      role: 'status',
      'aria-live': 'polite'
    });
    document.body.appendChild(host);
    return host;
  }

  /**
   * Shows a short message that goes away by itself.
   *
   * @param {string} message The message.
   * @param {string=} kind Its look, such as 'error' or 'success'.
   */
  function toast(message, kind) {
    var t = h(
      'div',
      { class: 'toast' + (kind ? ' toast-' + kind : '') },
      message
    );
    toastHost().appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, TOAST_MS);
  }

  /**
   * Makes the two buttons of a confirmation.
   *
   * @param {!Object} o The dialog, as confirmDialog takes it.
   * @param {function(boolean)} done Closes the dialog with the answer.
   * @return {{yes: !Element, no: !Element}} The buttons.
   */
  function dialogButtons(o, done) {
    var yes = h(
      'button',
      {
        type: 'button',
        class: 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'),
        name: 'confirm-yes',
        onclick: function () {
          if (!o.ready || o.ready()) done(true);
        }
      },
      o.confirmText || 'OK'
    );
    var no = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        onclick: function () {
          done(false);
        }
      },
      o.cancelText || 'Cancel'
    );
    return { yes: yes, no: no };
  }

  /**
   * Makes the box of a confirmation: its title, text, questions and
   * buttons.
   *
   * @param {!Object} o The dialog, as confirmDialog takes it.
   * @param {{yes: !Element, no: !Element}} buttons Its buttons.
   * @return {!Element} The box.
   */
  function dialogBox(o, buttons) {
    return h(
      'div',
      {
        class: 'dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': o.title
      },
      h('h2', { class: 'dialog-title' }, o.title),
      o.body ? h('p', null, o.body) : null,
      o.content || null,
      h('div', { class: 'dialog-actions' }, buttons.no, buttons.yes)
    );
  }

  /**
   * Shows a confirmation and gives the answer once. Escape, a click
   * outside the box, or the cancel button answer no.
   *
   * @param {!Object} o The dialog, as confirmDialog takes it.
   * @param {function(boolean)} resolve Gets the answer.
   */
  function openDialog(o, resolve) {
    var overlay;

    /**
     * Closes the dialog with an answer.
     *
     * @param {boolean} answer True when confirmed.
     */
    function done(answer) {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(answer);
    }

    /**
     * Answers no on Escape.
     *
     * @param {!KeyboardEvent} e The key pressed.
     */
    function onKey(e) {
      if (e.key === 'Escape') done(false);
    }

    var buttons = dialogButtons(o, done);
    overlay = h(
      'div',
      {
        class: 'overlay',
        onclick: function (e) {
          if (e.target === overlay) done(false);
        }
      },
      dialogBox(o, buttons)
    );
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    buttons.no.focus();
  }

  /**
   * Asks for a confirmation, styled like the rest of the page.
   * `o.content` is a node of questions under the text; `o.ready()` then
   * says whether they are answered, and a "no" keeps the dialog open.
   *
   * @param {!Object} o The dialog: `title`, and optionally `body`,
   *     `content`, `ready`, `danger`, `confirmText` and `cancelText`.
   * @return {!Promise<boolean>} True when confirmed.
   */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      openDialog(o, resolve);
    });
  }

  App.ui.toast = toast;
  App.ui.confirm = confirmDialog;
})(window.App);
