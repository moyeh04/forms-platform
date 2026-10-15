/**
 * The editor of named and short choices: rows with a value, an English
 * name and, when the list has one, an Arabic name, or chips for plain
 * values.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var h = App.ui.h;
  var icon = App.ui.icon;

  /** The size of the x on a chip. */
  var CHIP_ICON = 14;

  /**
   * Swaps a row with its neighbour.
   *
   * @param {!Object} p The page.
   * @param {number} i The row.
   * @param {number} d -1 for up, 1 for down.
   */
  function move(p, i, d) {
    var j = i + d;
    var t = p.rows[i];
    p.rows[i] = p.rows[j];
    p.rows[j] = t;
    p.paintRows();
    p.changed();
  }

  /**
   * Gives what saves one field of a row as it is typed.
   *
   * @param {!Object} p The page.
   * @param {!Object} r The row.
   * @param {string} key value, en or ar.
   * @return {function(string)} The handler.
   */
  function edit(p, r, key) {
    return function (v) {
      r[key] = v;
      p.changed();
    };
  }

  /**
   * Draws the buttons of a row: up, down and remove.
   *
   * @param {!Object} p The page.
   * @param {!Object} r The row.
   * @param {number} i Where it is.
   * @return {!Element} The buttons.
   */
  function rowTools(p, r, i) {
    return h(
      'span',
      { class: 'choice-tools' },
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm',
          'aria-label': 'Move up',
          disabled: i === 0,
          onclick: move.bind(null, p, i, -1)
        },
        '↑'
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm',
          'aria-label': 'Move down',
          disabled: i === p.rows.length - 1,
          onclick: move.bind(null, p, i, 1)
        },
        '↓'
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn sm danger',
          name: 'remove-' + i,
          'aria-label': 'Remove ' + (r.value || 'this choice'),
          onclick: function () {
            p.removeRow(i);
          }
        },
        icon('trash', A.ICON_SIZE.MENU)
      )
    );
  }

  /**
   * Draws a choice as a row. An Arabic name that differs from the value
   * is rare; its column exists only for a list that has one.
   *
   * @param {!Object} p The page.
   * @param {!Object} r The row.
   * @param {number} i Where it is.
   * @return {!Element} The row.
   */
  function rowEl(p, r, i) {
    return h(
      'li',
      { class: 'choice', dataset: { i: String(i) } },
      h('span', { class: 'choice-n' }, String(i + 1)),
      A.text(r.value, edit(p, r, 'value'), {
        class: 'input',
        name: 'value-' + i,
        'aria-label': 'Choice ' + (i + 1),
        dir: 'auto'
      }),
      A.text(r.en, edit(p, r, 'en'), {
        class: 'input choice-en',
        name: 'en-' + i,
        'aria-label': 'English name of choice ' + (i + 1),
        placeholder: 'English name',
        dir: 'ltr'
      }),
      p.withAr
        ? A.text(r.ar, edit(p, r, 'ar'), {
            class: 'input choice-ar',
            name: 'ar-' + i,
            'aria-label': 'Arabic name of choice ' + (i + 1),
            placeholder: 'الاسم بالعربية',
            dir: 'rtl',
            lang: 'ar'
          })
        : null,
      rowTools(p, r, i)
    );
  }

  /**
   * Draws a plain choice as a chip.
   *
   * @param {!Object} p The page.
   * @param {!Object} r The row.
   * @param {number} i Where it is.
   * @return {!Element} The chip.
   */
  function chipEl(p, r, i) {
    return h(
      'li',
      { class: 'value-chip', dataset: { i: String(i) } },
      h('span', { dir: 'auto' }, r.value),
      h(
        'button',
        {
          type: 'button',
          name: 'remove-' + i,
          'aria-label': 'Remove ' + r.value,
          onclick: function () {
            p.removeRow(i);
          }
        },
        icon('x', CHIP_ICON)
      )
    );
  }

  /**
   * Draws the choices as rows with their column heads.
   *
   * @param {!Object} p The page.
   * @return {!Array<!Element>} The heads and the rows.
   */
  function rowList(p) {
    var ar = p.withAr ? ' with-ar' : '';
    return [
      h(
        'div',
        { class: 'choice-head' + ar, 'aria-hidden': 'true' },
        h('span'),
        h('span', null, 'Choice'),
        h('span', null, 'English name'),
        p.withAr ? h('span', null, 'Arabic name') : null,
        h('span')
      ),
      h('ol', { class: 'choices' + ar }, p.rows.map(rowEl.bind(null, p)))
    ];
  }

  /**
   * Draws the link between the two views of a plain list. Chips cannot
   * rename or reorder, so a plain list offers the rows; rows of a plain
   * list offer the way back.
   *
   * @param {!Object} p The page.
   * @param {boolean} rows True while the rows are shown.
   * @return {!Element} The link.
   */
  function viewSwitch(p, rows) {
    return h(
      'button',
      {
        type: 'button',
        class: 'link-btn',
        name: rows ? 'short-view' : 'edit-rows',
        onclick: function () {
          p.order = !rows;
          p.paintRows();
          p.changed();
        }
      },
      rows ? 'Back to the short view' : 'Rename, reorder or add English names'
    );
  }

  /**
   * Draws the editor of named and short choices.
   *
   * @param {!Object} p The page.
   * @return {!Element} The editor.
   */
  L.choicesEditor = function (p) {
    var box = h('div');
    p.withAr = p.rows.some(function (r) {
      return r.ar;
    });
    var rows = L.asRows(p);
    var shown;
    if (!p.rows.length) {
      shown = h(
        'div',
        { class: 'empty' },
        h('strong', null, 'No choices yet.'),
        ' Add the first one below.'
      );
    } else if (!rows) {
      shown = h(
        'ul',
        { class: 'value-chips' },
        p.rows.map(chipEl.bind(null, p))
      );
    } else {
      shown = rowList(p);
    }
    [].concat(shown).forEach(function (node) {
      box.appendChild(node);
    });
    box.appendChild(L.adder(p, rows));
    if (p.rows.length && L.kindOf(p) !== ListKind.NAMED && !L.named(p)) {
      box.appendChild(viewSwitch(p, rows));
    }
    box.appendChild(L.many(p));
    return box;
  };
})(window.App);
