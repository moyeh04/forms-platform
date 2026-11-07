/** The PIN screen the dashboard opens on when this window is signed out. */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Checks a PIN with the backend and signs this window in, keeping the
   * trusted-device pass it answers. A refused PIN stays in its field,
   * selected, so typing replaces it.
   *
   * @param {!Object} v The screen: `pin`, `err`, `btn`, and `stop`, which
   *     stops the time left shown under the PIN.
   */
  async function signIn(v) {
    var res;
    v.stop();
    v.err.hidden = true;
    v.btn.disabled = true;
    try {
      res = await App.api.admin('admin.login', null, v.pin.value);
      App.api.setDevice(res.device);
      App.api.setPin(v.pin.value);
      A.render();
    } catch (ex) {
      if (ex.code === 'locked') {
        A.lockedView(ex, v.pin);
        return;
      }
      v.err.textContent = ex.message;
      if (ex.code === 'device_locked') {
        v.stop = A.countdown(v.err, A.lockEnd(ex), A.withClock(ex.message));
      }
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
      ),
      /** Stops the time left shown under the PIN; none runs yet. */
      stop: function () {}
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
