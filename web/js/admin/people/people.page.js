/**
 * The Clients page: the private links that let instructors and clients
 * see chosen forms without a Google account or a PIN.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  var HEADINGS = [
    'Name',
    'Can see',
    'Hidden columns',
    'Can review',
    'Small teams',
    'Progress',
    'Link',
    'Access key',
    ''
  ];

  /**
   * Draws the head of the page and the button that makes a link.
   *
   * @param {!Array<!Object>} forms Every form.
   * @return {!Element} The head.
   */
  function pageHead(forms) {
    return h(
      'div',
      { class: 'page-head' },
      h('h2', null, 'Clients and instructors'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          name: 'newClient',
          onclick: function () {
            A.clientDialog(null, forms);
          }
        },
        ui.icon('plus', A.ICON_SIZE.BUTTON),
        'New private link'
      )
    );
  }

  /**
   * Draws the table of the links.
   *
   * @param {!Array<!Object>} clients The links.
   * @param {!Array<!Object>} forms Every form.
   * @return {!Element} The table.
   */
  function table(clients, forms) {
    return h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'data-table cards' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            HEADINGS.map(function (c) {
              return h('th', null, c);
            })
          )
        ),
        h(
          'tbody',
          null,
          clients.map(function (c) {
            return A.clientRow(c, forms);
          })
        )
      )
    );
  }

  /**
   * Draws the Clients page.
   *
   * @param {!Element} mount Where the page goes.
   * @return {!Promise} Settles once it is drawn.
   */
  A.views.clients = async function (mount) {
    var both = await Promise.all([
      A.call('admin.clients.list'),
      A.call('admin.forms.list')
    ]);
    var clients = both[0].clients;
    var forms = both[1].forms;
    ui.clear(mount);
    mount.appendChild(pageHead(forms));
    mount.appendChild(
      h(
        'p',
        { class: 'help' },
        'A private link lets an instructor or client see chosen forms without' +
          ' a Google account or a PIN. It is read-only, and you choose which' +
          ' columns they see. With an access key, the link also asks for six' +
          ' digits that you send separately, so a forwarded link opens' +
          ' nothing. A link can end on a date, and you can turn it off at any' +
          ' time.'
      )
    );
    mount.appendChild(
      clients.length
        ? table(clients, forms)
        : h('div', { class: 'empty' }, 'No private links yet.')
    );
  };
})(window.App);
