/**
 * Adding choices: one at a time with its English name, or many at once
 * from pasted lines.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Adds the typed choice and puts the focus back in the field.
   *
   * @param {!Object} p The page.
   * @param {!Element} v The field of the value.
   * @param {?Element} en The field of the English name, or null.
   */
  function addOne(p, v, en) {
    if (!v.value.trim()) {
      v.focus();
      return;
    }
    p.rows.push({
      value: v.value.trim(),
      en: en ? en.value.trim() : '',
      ar: ''
    });
    p.paintRows();
    p.changed();
    var next = p.rowsBox.querySelector('[name="new-value"]');
    if (next?.focus) next.focus();
  }

  /**
   * Draws the fields of a new choice and its Add button; Enter adds too.
   *
   * @param {!Object} p The page.
   * @param {boolean} rows True when the choices are rows, which have names.
   * @return {!Element} The row.
   */
  L.adder = function (p, rows) {
    var v = h('input', {
      class: 'input',
      name: 'new-value',
      placeholder: 'New choice',
      dir: 'auto',
      'aria-label': 'New choice'
    });
    var en = rows
      ? h('input', {
          class: 'input',
          name: 'new-en',
          placeholder: 'English name (optional)',
          dir: 'ltr',
          'aria-label': 'English name of the new choice'
        })
      : null;
    var add = addOne.bind(null, p, v, en);
    [v, en].forEach(function (x) {
      if (!x) return;
      x.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
    });
    return h(
      'div',
      { class: 'choice-add' + (rows ? '' : ' short') },
      v,
      en,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: 'add-choice',
          onclick: function () {
            add();
          }
        },
        ui.icon('plus', A.ICON_SIZE.LINE),
        'Add'
      )
    );
  };

  /**
   * Takes the pasted choices, after the rows or in their place.
   *
   * @param {!Object} p The page.
   * @param {!Element} paste The box.
   * @param {boolean} replace True to replace the rows.
   */
  function usePasted(p, paste, replace) {
    p.rows = (replace ? [] : p.rows).concat(L.parse(paste.value));
    paste.value = '';
    p.paintRows();
    p.changed();
  }

  /**
   * Draws the buttons for what was pasted: add to the end, or replace a
   * list that has choices.
   *
   * @param {!Object} p The page.
   * @param {!Element} paste The box.
   * @param {!Element} acts Where the buttons go.
   */
  function paintActs(p, paste, acts) {
    ui.clear(acts);
    var n = L.parse(paste.value).length;
    if (!n) return;
    acts.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: 'paste-add',
          onclick: usePasted.bind(null, p, paste, false)
        },
        'Add ' + A.plural(n, 'choice', 'choices') + ' to the end'
      )
    );
    if (p.rows.length) {
      acts.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet sm',
            name: 'paste-replace',
            onclick: usePasted.bind(null, p, paste, true)
          },
          'Replace the list with ' + (n === 1 ? 'it' : 'them')
        )
      );
    }
  }

  /**
   * Draws the folded box that takes many choices in one step, as pasted
   * lines.
   *
   * @param {!Object} p The page.
   * @return {!Element} The box.
   */
  L.many = function (p) {
    var paste = h('textarea', {
      class: 'textarea',
      rows: '5',
      name: 'paste-list',
      placeholder:
        'One choice on each line. For an English name, add a bar:\n' +
        'حاسبات | Computers',
      'aria-label': 'Choices, one on each line'
    });
    var acts = h('div', { class: 'actions' });
    paste.addEventListener('input', paintActs.bind(null, p, paste, acts));
    return h(
      'details',
      { class: 'list-many', name: 'add-many' },
      h('summary', null, 'Paste many at once'),
      paste,
      acts
    );
  };
})(window.App);
