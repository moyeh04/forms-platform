/**
 * The dashboard's dialogs: one with its own buttons, and one that shows a
 * link or a key once, with a copy button.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Makes a button of a dialog. A button with no action closes it; one
   * with an action closes it once the action is done, unless the action
   * answers false.
   *
   * @param {!Object} b The button: `text`, `kind`, `onclick(close)`.
   * @param {function()} close Closes the dialog.
   * @return {!Element} The button.
   */
  function dialogButton(b, close) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-' + (b.kind || 'quiet'),
        onclick: function (e) {
          if (!b.onclick) return close();
          A.busy(e.currentTarget, async function () {
            if ((await b.onclick(close)) !== false) close();
          });
        }
      },
      b.text
    );
  }

  /**
   * Opens a dialog over the page. Escape closes the dialog on top, like
   * Cancel, and so does a click outside it.
   *
   * @param {string} title Its title.
   * @param {*} body What it shows.
   * @param {!Array<!Object>=} buttons Its buttons; one Close when absent.
   * @return {{close: function(), el: !Element}} The dialog.
   */
  A.modal = function (title, body, buttons) {
    var overlay;

    /**
     * Closes the dialog when Escape is pressed and it is on top.
     *
     * @param {!KeyboardEvent} e The key.
     */
    function onKey(e) {
      var all = document.querySelectorAll('.overlay');
      if (e.key === 'Escape' && all[all.length - 1] === overlay) {
        e.stopImmediatePropagation();
        close();
      }
    }

    /** Closes the dialog. */
    function close() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    var actions = (buttons || [{ text: 'Close', kind: 'quiet' }]).map(
      function (b) {
        return dialogButton(b, close);
      }
    );
    overlay = h(
      'div',
      {
        class: 'overlay',
        onclick: function (e) {
          if (e.target === overlay) close();
        }
      },
      h(
        'div',
        {
          class: 'dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title
        },
        h('h2', { class: 'dialog-title' }, title),
        body,
        h('div', { class: 'dialog-actions' }, actions)
      )
    );
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    return { close: close, el: overlay };
  };

  /**
   * Shows a link or a key that is shown only once, with a copy button.
   *
   * @param {string} title The title.
   * @param {string} note What it is.
   * @param {string} value The link or the key.
   * @param {boolean=} big True to show it large, as a key.
   * @return {{close: function(), el: !Element}} The dialog.
   */
  A.reveal = function (title, note, value, big) {
    var body = h(
      'div',
      null,
      h('p', null, note),
      big
        ? h('div', { class: 'key-reveal' }, value)
        : h('div', { class: 'link-box' }, h('code', null, value))
    );

    /**
     * Copies the value and keeps the dialog open.
     *
     * @return {!Promise<boolean>} False, so the dialog stays.
     */
    async function copy() {
      var copied = await App.ui.copyText(value);
      App.ui.toast(copied ? 'Copied' : 'Could not copy', 'ok');
      return false;
    }

    return A.modal(title, body, [
      { text: 'Copy', kind: 'primary', onclick: copy },
      { text: 'Done', kind: 'quiet' }
    ]);
  };
})(window.App);
