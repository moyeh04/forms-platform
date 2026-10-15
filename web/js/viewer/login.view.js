/**
 * The screens shown before a link opens: the access key a link asks for,
 * and the reason a link cannot be opened.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var ui = App.ui;
  var h = ui.h;

  /** How many digits an access key has. */
  var KEY_DIGITS = Rules.accessKeyDigits();

  /**
   * Draws what the page is and the theme switch.
   *
   * @return {!Element} The row.
   */
  function loginTop() {
    return h(
      'div',
      { class: 'login-top' },
      h('span', { class: 'tool-label' }, 'Instructor view'),
      ui.themeButton()
    );
  }

  /**
   * Draws a screen of its own: the top row and a sheet.
   *
   * @param {...*} content What the sheet holds.
   * @return {!Element} The screen.
   */
  function screen(...content) {
    return h(
      'div',
      { class: 'login' },
      loginTop(),
      h('div', { class: 'sheet' }, h('div', { class: 'wrap' }, content))
    );
  }

  /**
   * Opens the link with the typed key, or keeps it in its field with the
   * reason when it is not six digits.
   *
   * @param {!Object} k The form: its input and whether it is busy.
   * @param {!Event} e The submit.
   * @return {!Promise} Settles once the link opens or not.
   */
  async function submitKey(k, e) {
    e.preventDefault();
    if (k.busy) return;
    S.key = k.input.value.replace(/\D/g, '');
    if (S.key.length !== KEY_DIGITS) {
      S.keyError = 'The key has six digits.';
      return V.render();
    }
    k.busy = true;
    await V.open();
  }

  /**
   * Draws the form that asks for the access key.
   *
   * @return {!Element} The form.
   */
  function keyForm() {
    var k = {
      busy: false,
      input: h('input', {
        class: 'input key-input',
        id: 'access-key',
        type: 'text',
        inputmode: 'numeric',
        maxlength: String(KEY_DIGITS),
        autocomplete: 'one-time-code',
        placeholder: '0'.repeat(KEY_DIGITS),
        'aria-label': 'Access key',
        'aria-describedby': 'access-key-err',
        value: S.key
      })
    };
    return h(
      'form',
      { novalidate: 'novalidate', onsubmit: submitKey.bind(null, k) },
      k.input,
      h(
        'p',
        { class: 'error', id: 'access-key-err', role: 'alert' },
        S.keyError || ''
      ),
      h(
        'div',
        { class: 'nav' },
        h(
          'button',
          { type: 'submit', class: 'btn btn-primary', name: 'open-view' },
          'Open'
        )
      )
    );
  }

  /**
   * Draws the screen of a link with a key: it asks for the key, and keeps
   * a wrong one in its field with the reason.
   *
   * @return {!Element} The screen.
   */
  V.keyView = function () {
    return screen(
      h('h1', { class: 'step-title' }, 'Enter the access key'),
      h(
        'p',
        null,
        'This is a private page for an instructor: the teams, bookings or' +
          ' registrations of the forms shared with you. It also needs the' +
          ' six-digit key that was sent to you separately.'
      ),
      keyForm()
    );
  };

  /**
   * Draws the screen of a link that cannot be opened.
   *
   * @param {string} reason Why.
   * @return {!Element} The screen.
   */
  V.closedView = function (reason) {
    return screen(
      h('h1', { class: 'step-title' }, 'This link cannot be opened'),
      h('p', null, reason)
    );
  };
})(window.App);
