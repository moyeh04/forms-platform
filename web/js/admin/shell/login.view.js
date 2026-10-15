/** The PIN screen the dashboard opens on when this window is signed out. */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Checks a PIN with the backend and signs this window in. A refused PIN
   * stays in its field, selected, so typing replaces it.
   *
   * @param {!Object} v The screen: `pin`, `err`, `btn`.
   */
  async function signIn(v) {
    v.err.hidden = true;
    v.btn.disabled = true;
    try {
      await App.api.call({
        action: 'admin.login',
        admin: { pin: v.pin.value }
      });
      App.api.setPin(v.pin.value);
      A.render();
    } catch (ex) {
      v.err.textContent = ex.message;
      v.err.hidden = false;
      v.pin.focus();
      v.pin.select();
    } finally {
      v.btn.disabled = false;
    }
  }

  /**
   * Draws the PIN screen.
   *
   * @param {!Element} root Where it is drawn.
   */
  A.loginView = function (root) {
    var v = {
      pin: h('input', {
        class: 'input pin-input',
        type: 'password',
        inputmode: 'numeric',
        autocomplete: 'current-password',
        id: 'pin',
        name: 'pin',
        'aria-describedby': 'pin-err'
      }),
      err: h('p', {
        class: 'error',
        id: 'pin-err',
        role: 'alert',
        hidden: true
      }),
      btn: h(
        'button',
        { type: 'submit', class: 'btn btn-primary' },
        'Open dashboard'
      )
    };
    var form = h(
      'form',
      {
        novalidate: 'novalidate',
        onsubmit: function (e) {
          e.preventDefault();
          return signIn(v);
        }
      },
      h('h1', { class: 'step-title' }, 'Admin dashboard'),
      h(
        'p',
        { class: 'help' },
        'Enter the admin PIN you set from the Forms Platform menu in the' +
          ' registry sheet.'
      ),
      h(
        'label',
        { class: 'field', for: 'pin' },
        h('span', { class: 'label' }, 'Admin PIN')
      ),
      v.pin,
      v.err,
      h('div', { class: 'nav' }, v.btn)
    );
    root.appendChild(
      h(
        'div',
        { class: 'login' },
        h('div', { class: 'login-top' }, App.ui.themeButton()),
        h('div', { class: 'sheet' }, h('div', { class: 'wrap' }, form))
      )
    );
    v.pin.focus();
  };
})(window.App);
