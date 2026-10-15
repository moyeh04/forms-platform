/**
 * The keys the Extend keys dialog acts on: the groups the admin picks
 * from, and the teams to choose with their search. Each change calls
 * `v.changed()` of the dialog.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var clear = App.ui.clear;

  /** The groups of keys the admin can pick, with their labels. */
  var WHICH = [
    { id: 'all', label: 'All' },
    { id: 'expired', label: 'Expired' },
    { id: 'soon', label: 'Ending in 3 days' },
    { id: 'chosen', label: 'Choose teams' }
  ];

  /**
   * Lists the keys the search finds.
   *
   * @param {!Object} v The dialog.
   * @return {!Array<!Object>} The keys.
   */
  function shown(v) {
    return v.keys.filter(function (k) {
      var text = (k.ref + ' ' + k.name + ' ' + k.title).toLowerCase();
      return !v.search || text.indexOf(v.search) !== -1;
    });
  }

  /**
   * Draws the chips of the groups. A group with nothing in it cannot act,
   * so it is left out; All is always there.
   *
   * @param {!Object} v The dialog.
   */
  A.paintKeyWhich = function (v) {
    clear(v.whichBox);
    WHICH.forEach(function (w) {
      var count = w.id === 'chosen' ? null : v.groups[w.id].length;
      if (count === 0 && w.id !== 'all') return;
      v.whichBox.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'toggle-chip',
            name: 'which-' + w.id,
            'aria-pressed': v.which === w.id ? 'true' : 'false',
            onclick: function () {
              v.which = w.id;
              A.paintKeyWhich(v);
              A.paintKeyList(v);
              v.changed();
            }
          },
          w.label,
          count === null
            ? null
            : h('span', { class: 'chip-count' }, String(count))
        )
      );
    });
  };

  /**
   * Draws the line of a team to choose.
   *
   * @param {!Object} v The dialog.
   * @param {!Object} k Its key.
   * @return {!Element} The line.
   */
  function keyRow(v, k) {
    var on = v.chosen.indexOf(k.id) !== -1;
    return h(
      'label',
      { class: 'key-row' + (on ? ' on' : '') },
      h('input', {
        type: 'checkbox',
        name: 'key-' + k.ref,
        checked: on,
        onchange: function (e) {
          v.chosen = v.chosen.filter(function (x) {
            return x !== k.id;
          });
          if (e.target.checked) v.chosen.push(k.id);
          A.paintKeyRows(v);
          v.changed();
        }
      }),
      h('span', { class: 'mono' }, k.ref),
      h(
        'span',
        { class: 'key-row-name' },
        h('bdi', null, k.name || '-'),
        k.title ? h('span', { class: 'muted-note' }, ' · ' + k.title) : null
      ),
      A.untilText(k.keyExpires, 'No end date')
    );
  }

  /**
   * Draws the teams the search finds.
   *
   * @param {!Object} v The dialog.
   */
  A.paintKeyRows = function (v) {
    clear(v.rowsBox);
    var list = shown(v);
    if (!list.length) {
      v.rowsBox.appendChild(
        h('p', { class: 'muted-note' }, 'No team matches.')
      );
      return;
    }
    list.forEach(function (k) {
      v.rowsBox.appendChild(keyRow(v, k));
    });
  };

  /**
   * Makes a link button of the team list.
   *
   * @param {!Object} v The dialog.
   * @param {string} name Its name.
   * @param {string} text Its words.
   * @param {function()} act What it does to the chosen teams.
   * @return {!Element} The button.
   */
  function listButton(v, name, text, act) {
    return h(
      'button',
      {
        type: 'button',
        class: 'link-btn',
        name: name,
        onclick: function () {
          act();
          A.paintKeyRows(v);
          v.changed();
        }
      },
      text
    );
  }

  /**
   * Draws the search and the teams while Choose teams is picked.
   *
   * @param {!Object} v The dialog.
   */
  A.paintKeyList = function (v) {
    clear(v.listBox);
    if (v.which !== 'chosen') return;
    v.listBox.appendChild(
      h(
        'div',
        { class: 'key-tools' },
        v.searchInput,
        listButton(v, 'choose-shown', 'Choose all shown', function () {
          shown(v).forEach(function (k) {
            if (v.chosen.indexOf(k.id) === -1) v.chosen.push(k.id);
          });
        }),
        listButton(v, 'choose-none', 'Clear', function () {
          v.chosen = [];
        })
      )
    );
    v.listBox.appendChild(v.rowsBox);
    A.paintKeyRows(v);
  };
})(window.App);
