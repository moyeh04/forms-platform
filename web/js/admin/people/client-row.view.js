/**
 * A private link in the Clients table: who it is for, what it shows, its
 * state and end, its access key, and what can be done to it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  /**
   * Draws a button that waits for its action, then draws the page again.
   *
   * @param {string} name The name of the button.
   * @param {string} cls Its class.
   * @param {*} text What it shows.
   * @param {function(): !Promise} act What it does.
   * @return {!Element} The button.
   */
  function actButton(name, cls, text, act) {
    return h(
      'button',
      {
        type: 'button',
        class: cls,
        name: name,
        onclick: function (e) {
          A.busy(e.currentTarget, act);
        }
      },
      text
    );
  }

  /**
   * Names the forms a link shows.
   *
   * @param {!Object} c The client.
   * @param {!Array<!Object>} forms Every form.
   * @return {string} The titles, or 'All forms'.
   */
  function accessText(c, forms) {
    if (c.forms.indexOf('*') !== -1) return 'All forms';
    return c.forms
      .map(function (id) {
        var f = forms.filter(function (x) {
          return x.id === id;
        })[0];
        return f ? f.title : id;
      })
      .join(', ');
  }

  /**
   * Draws the state of the link, its end, and the button that moves it.
   *
   * @param {!Object} c The client.
   * @return {!Element} The cell content.
   */
  function linkCell(c) {
    var badge = A.badge('On', 'open');
    if (!c.active) badge = A.badge('Off', 'closed');
    else if (c.expired) badge = A.badge('Ended', 'closed');
    return h(
      'div',
      { class: 'client-key' },
      badge,
      c.active ? A.untilText(c.expires) : null,
      c.active
        ? h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: 'change-end',
              onclick: function () {
                A.linkEndDialog(c);
              }
            },
            c.expired ? 'Extend' : 'Change'
          )
        : null
    );
  }

  /**
   * Shows the access key of a link again.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is shown.
   */
  async function showKey(c) {
    var r = await A.call('admin.clients.showKey', { id: c.id });
    A.revealAccess('Access key for ' + c.name, '', r.accessKey);
  }

  /**
   * Makes a key for a link, after a confirmation when it replaces one.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is made or not.
   */
  async function newKey(c) {
    if (
      c.hasKey &&
      !(await ui.confirm({
        title: 'Make a new key for ' + c.name + '?',
        body: 'The old key stops working right away. Send them the new one.',
        confirmText: 'Make new key'
      }))
    ) {
      return;
    }
    var r = await A.call('admin.clients.key', { id: c.id, on: true });
    A.revealAccess(
      (c.hasKey ? 'New access key for ' : 'Access key for ') + c.name,
      '',
      r.accessKey
    );
    A.render();
  }

  /**
   * Removes the key of a link after a confirmation.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is removed or not.
   */
  async function removeKey(c) {
    var ok = await ui.confirm({
      title: 'Remove the key of ' + c.name + '?',
      body: 'The link alone will open their view again.',
      confirmText: 'Remove key',
      danger: true
    });
    if (!ok) return;
    await A.call('admin.clients.key', { id: c.id, on: false });
    toast('The link no longer asks for a key.', 'ok');
    A.render();
  }

  /**
   * Draws whether the link asks for a key, and its buttons.
   *
   * @param {!Object} c The client.
   * @return {!Element} The cell content.
   */
  function keyCell(c) {
    return h(
      'div',
      { class: 'client-key' },
      c.hasKey ? 'Asked' : h('span', { class: 'warn-text' }, 'Not asked'),
      c.keyKnown
        ? actButton('show-key', 'link-btn', 'Show', showKey.bind(null, c))
        : null,
      actButton(
        'new-key',
        'link-btn',
        c.hasKey ? 'New key' : 'Add a key',
        newKey.bind(null, c)
      ),
      c.hasKey
        ? actButton('remove-key', 'link-btn', 'Remove', removeKey.bind(null, c))
        : null
    );
  }

  /**
   * Makes a new link after a confirmation; the old one stops working.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is made or not.
   */
  async function newLink(c) {
    var ok = await ui.confirm({
      title: 'Make a new link for ' + c.name + '?',
      body: 'The old link stops working right away.',
      confirmText: 'Make new link'
    });
    if (!ok) return;
    var r = await A.call('admin.clients.regenerate', { id: c.id });
    A.revealAccess('New link for ' + c.name, r.token, '');
    A.render();
  }

  /**
   * Turns a link off, or on again.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is saved.
   */
  async function toggle(c) {
    await A.call('admin.clients.update', {
      id: c.id,
      patch: { active: !c.active }
    });
    toast(c.active ? 'Link turned off' : 'Link turned on', 'ok');
    A.render();
  }

  /**
   * Deletes a link after a confirmation.
   *
   * @param {!Object} c The client.
   * @return {!Promise} Settles once it is deleted or not.
   */
  async function remove(c) {
    var ok = await ui.confirm({
      title: 'Delete ' + c.name + '?',
      body: 'Their link stops working and cannot be restored.',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    await A.call('admin.clients.remove', { id: c.id });
    toast('Deleted', 'ok');
    A.render();
  }

  /**
   * Draws the actions of a link: Edit, New link, Turn off or on, Delete.
   *
   * @param {!Object} c The client.
   * @param {!Array<!Object>} forms Every form, for the Edit dialog.
   * @return {!Element} The cell content.
   */
  function actions(c, forms) {
    var quiet = 'btn btn-quiet sm';
    return h(
      'div',
      { class: 'actions' },
      h(
        'button',
        {
          type: 'button',
          class: quiet,
          name: 'edit',
          onclick: function () {
            A.clientDialog(c, forms);
          }
        },
        'Edit'
      ),
      actButton('regenerate', quiet, 'New link', newLink.bind(null, c)),
      actButton(
        'toggle',
        quiet,
        c.active ? 'Turn off' : 'Turn on',
        toggle.bind(null, c)
      ),
      actButton(
        'delete',
        quiet,
        ui.icon('trash', A.ICON_SIZE.LINE),
        remove.bind(null, c)
      )
    );
  }

  /**
   * Draws a cell with the label the narrow layout shows beside it.
   *
   * @param {string} label The label.
   * @param {*} content What it holds.
   * @return {!Element} The cell.
   */
  function cell(label, content) {
    return h('td', { dataset: { label: label } }, content);
  }

  /**
   * Draws a private link as a row of the table.
   *
   * @param {!Object} c The client.
   * @param {!Array<!Object>} forms Every form.
   * @return {!Element} The row.
   */
  A.clientRow = function (c, forms) {
    return h(
      'tr',
      { dataset: { client: c.id } },
      h('td', { class: 'nm' }, h('strong', null, c.name)),
      cell('Can see', accessText(c, forms) || 'No forms'),
      cell(
        'Hidden columns',
        c.hiddenColumns.length ? c.hiddenColumns.join(', ') : 'None'
      ),
      cell('Can review', c.canReview ? 'Yes' : 'No'),
      cell('Small teams', c.showSizeAlerts ? 'Shown' : 'Hidden'),
      cell('Link', linkCell(c)),
      cell('Access key', keyCell(c)),
      h('td', null, actions(c, forms))
    );
  };
})(window.App);
