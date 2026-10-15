/** Copies text to the clipboard, with a fallback for older browsers. */
(function (App) {
  'use strict';

  var h = App.ui.h;

  /**
   * Copies text through a hidden text box, for browsers without the
   * clipboard API.
   *
   * @param {string} text The text.
   * @return {boolean} True when the browser copied it.
   */
  function copyByCommand(text) {
    var ta = h('textarea', {
      'aria-hidden': 'true',
      style: { position: 'fixed', opacity: '0' }
    });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  /**
   * Copies text to the clipboard.
   *
   * @param {string} text The text.
   * @return {!Promise<boolean>} True when it was copied.
   */
  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    return copyByCommand(text);
  }

  App.ui.copyText = copyText;
})(window.App);
