/**
 * The dialog that shows a private link and its access key apart, so they
 * can be sent through two channels.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Draws the button that copies a value.
   *
   * @param {string} value The link or the key.
   * @return {!Element} The button.
   */
  function copyButton(value) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        onclick: async function () {
          var copied = await ui.copyText(value);
          ui.toast(copied ? 'Copied' : 'Could not copy', 'ok');
        }
      },
      ui.icon('copy', A.ICON_SIZE.MENU),
      'Copy'
    );
  }

  /**
   * Draws a value with its label, its copy button and its help.
   *
   * @param {string} label The label.
   * @param {!Element} shown The value as shown.
   * @param {string} value The value to copy.
   * @param {string} help What to do with it.
   * @return {!Element} The block.
   */
  function block(label, shown, value, help) {
    return h(
      'div',
      null,
      h('span', { class: 'label' }, label),
      shown,
      copyButton(value),
      h('p', { class: 'help' }, help)
    );
  }

  /**
   * Shows a link and its key apart. The link is shown only once (only its
   * hash is kept); the key can be looked up again from the list.
   *
   * @param {string} title The title.
   * @param {string} token The token of the link, or '' for none.
   * @param {string} key The access key, or '' for none.
   * @return {{close: function(), el: !Element}} The dialog.
   */
  A.revealAccess = function (title, token, key) {
    var link = token ? A.viewerLink(token) : '';
    var body = h(
      'div',
      { class: 'access-reveal l-stack' },
      link
        ? block(
            'Link',
            h('div', { class: 'link-box' }, h('code', null, link)),
            link,
            'Shown only this once. If it is lost, make a new link.'
          )
        : null,
      key
        ? block(
            'Access key',
            h('div', { class: 'key-reveal', name: 'access-key' }, key),
            key,
            'Send the key apart from the link, for example the link by' +
              ' email and the key by WhatsApp. The link alone opens nothing.' +
              ' You can see the key again from the list.'
          )
        : null
    );
    return A.modal(title, body, [{ text: 'Done', kind: 'primary' }]);
  };
})(window.App);
