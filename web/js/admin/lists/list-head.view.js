/**
 * The head of the open list: its name with Rename and Delete for a list
 * the admin made, what it is for, and the forms that ask it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /** The longest name of a list. */
  var NAME_MAX = 60;

  /**
   * Draws the field that renames the list, with Rename and Cancel.
   *
   * @param {!Object} p The page.
   * @return {!Element} The row.
   */
  function renameRow(p) {
    var input = A.text(L.nameOf(p), function () {}, {
      name: 'rename-input',
      'aria-label': 'Name of the list',
      maxlength: String(NAME_MAX)
    });
    var renameBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: 'rename-save',
        onclick: function () {
          A.busy(renameBtn, async function () {
            var out = await A.call('admin.lists.rename', {
              key: p.key,
              name: input.value
            });
            p.info = out.info;
            p.renaming = false;
            p.paint();
          });
        }
      },
      'Rename'
    );
    return h(
      'div',
      { class: 'list-rename' },
      input,
      renameBtn,
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          onclick: function () {
            p.renaming = false;
            p.paint();
          }
        },
        'Cancel'
      )
    );
  }

  /**
   * Deletes the list after a confirmation, then shows the index.
   *
   * @param {!Object} p The page.
   * @param {!Event} e The click.
   * @return {!Promise} Settles once it is deleted or not.
   */
  async function deleteList(p, e) {
    var btn = e.currentTarget;
    var yes = await ui.confirm({
      title: 'Delete ' + L.nameOf(p) + '?',
      body: 'No form asks this list. It is removed for good.',
      confirmText: 'Delete',
      danger: true
    });
    if (!yes) return;
    A.busy(btn, async function () {
      var out = await A.call('admin.lists.delete', { key: p.key });
      p.lists = out.lists;
      p.info = out.info;
      A.unsaved = false;
      L.load(p, L.keys(p)[0]);
      p.open = false;
      A.setHash('#/lists');
      p.paint();
    });
  }

  /**
   * Draws the name of the list, its kind when the name does not say it,
   * and Rename and Delete for a list the admin made. Deleting is offered
   * only while no form asks the list.
   *
   * @param {!Object} p The page.
   * @param {boolean} custom True for a list the admin made.
   * @param {number} users How many forms ask it.
   * @return {!Element} The row.
   */
  function titleRow(p, custom, users) {
    var kindLabel = L.KINDS[L.kindOf(p)].label;
    return h(
      'div',
      { class: 'list-title' },
      h('h2', null, L.nameOf(p)),
      L.nameOf(p) !== kindLabel
        ? h('span', { class: 'list-card-kind' }, kindLabel)
        : null,
      custom
        ? h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: 'rename-list',
              onclick: function () {
                p.renaming = true;
                p.paint();
              }
            },
            'Rename'
          )
        : null,
      custom && !users
        ? h(
            'button',
            {
              type: 'button',
              class: 'link-btn danger-link',
              name: 'delete-list',
              onclick: deleteList.bind(null, p)
            },
            'Delete'
          )
        : null
    );
  }

  /**
   * Draws the forms that ask the list, each a link to its Questions tab.
   *
   * @param {!Array<!Object>} users The forms.
   * @return {!Element} The line.
   */
  function usedBy(users) {
    return h(
      'p',
      { class: 'used-by' },
      users.length
        ? users.reduce(
            function (out, f, i) {
              return out.concat(
                i ? ', ' : [],
                h(
                  'a',
                  { href: '#/f/' + encodeURIComponent(f.slug) + '/questions' },
                  f.title
                )
              );
            },
            ['Asked by ']
          )
        : 'No form asks it yet. Pick it for a question in the Questions tab' +
            ' of a form.'
    );
  }

  /**
   * Draws the head of the open list.
   *
   * @param {!Object} p The page.
   * @return {!Element} The head.
   */
  L.headPane = function (p) {
    var custom = !!p.info[p.key];
    var users = L.formsUsing(p.forms, p.key);
    var about = L.BUILTIN[p.key]?.about || L.KINDS[L.kindOf(p)].about;
    return h(
      'div',
      { class: 'list-head' },
      p.renaming ? renameRow(p) : titleRow(p, custom, users.length),
      h('p', { class: 'help' }, about),
      usedBy(users)
    );
  };
})(window.App);
