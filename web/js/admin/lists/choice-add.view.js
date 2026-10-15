/**
 * Adding choices: one at a time with its English name, or many at once
 * from pasted lines. A milestone is added by its name; its value is a new
 * id.
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
    p.rows.push(
      p.milestones
        ? milestoneRow(p, v.value.trim())
        : { value: v.value.trim(), en: en ? en.value.trim() : '', ar: '' }
    );
    p.paintRows();
    p.changed();
    var next = p.rowsBox.querySelector('[name="new-value"]');
    if (next?.focus) next.focus();
  }

  /**
   * Makes the row of a new milestone: its name, and an id no row has and
   * no saved milestone had.
   *
   * @param {!Object} p The page.
   * @param {string} name The English name.
   * @param {string=} ar The Arabic name.
   * @param {!Array<!Object>=} more Rows not on the page yet.
   * @return {!Object} The row.
   */
  function milestoneRow(p, name, ar, more) {
    var taken = p.rows
      .concat(more || [], p.lists[p.key] || [])
      .map(function (o) {
        return String(o.value);
      });
    return { value: L.newMilestoneId(taken), en: name, ar: ar || '' };
  }

  /**
   * Turns a pasted line into a milestone: "English | Arabic".
   *
   * @param {!Object} p The page.
   * @param {!Array<!Object>} out The milestones made so far.
   * @param {!Object} r The line as a row: value and en.
   * @return {!Array<!Object>} The milestones with this one.
   */
  function pastedMilestone(p, out, r) {
    out.push(milestoneRow(p, r.value, r.en, out));
    return out;
  }

  /**
   * Draws the fields of a new choice and its Add button; Enter adds too.
   *
   * @param {!Object} p The page.
   * @param {boolean} rows True when the choices are rows, which have names.
   * @return {!Element} The row.
   */
  L.adder = function (p, rows) {
    var word = p.milestones ? 'New milestone' : 'New choice';
    var v = h('input', {
      class: 'input',
      name: 'new-value',
      placeholder: p.milestones ? word + ' (English name)' : word,
      dir: 'auto',
      'aria-label': word
    });
    var en =
      rows && !p.milestones
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
      { class: 'choice-add' + (rows && !p.milestones ? '' : ' short') },
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
        p.milestones ? 'Add a milestone' : 'Add'
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
    var rows = L.parse(paste.value);
    if (p.milestones) rows = rows.reduce(pastedMilestone.bind(null, p), []);
    p.rows = (replace ? [] : p.rows).concat(rows);
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
        'Add ' +
          (p.milestones
            ? A.plural(n, 'milestone', 'milestones')
            : A.plural(n, 'choice', 'choices')) +
          ' to the end'
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
      placeholder: p.milestones
        ? 'One milestone on each line. For an Arabic name, add a bar:\n' +
          'Task 1 | المهمة 1'
        : 'One choice on each line. For an English name, add a bar:\n' +
          'حاسبات | Computers',
      'aria-label': p.milestones
        ? 'Milestones, one on each line'
        : 'Choices, one on each line'
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
