/**
 * "+ New kind": a chip that turns into a field. Enter or Add takes the
 * kind, Escape gives up, and a refused kind stays in the field with its
 * reason.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var ui = App.ui;
  var h = ui.h;

  /** The most letters a kind has. */
  var KIND_LETTERS = 3;

  /**
   * Takes the typed kind, or shows why it is refused.
   *
   * @param {!Object} c The chip: name, known kinds, take, field and error.
   */
  function go(c) {
    var code = L.cleanCode(c.input.value, KIND_LETTERS);
    var why = L.newKindProblem(code, c.known);
    if (why) {
      c.err.textContent = why;
      if (c.input.focus) c.input.focus();
      return;
    }
    c.take(code);
  }

  /**
   * Draws the field of a new kind.
   *
   * @param {!Object} c The chip.
   * @return {!Element} The field.
   */
  function field(c) {
    return h('input', {
      class: 'input sec-letter',
      name: c.name + '-new',
      maxlength: String(KIND_LETTERS),
      placeholder: 'L',
      'aria-label': 'New kind',
      'aria-describedby': c.name + '-err',
      autocomplete: 'off',
      oninput: function (e) {
        e.target.value = L.cleanCode(e.target.value, KIND_LETTERS);
        c.err.textContent = '';
      },
      onkeydown: function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          go(c);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          paint(c, false);
        }
      }
    });
  }

  /**
   * Draws the chip, or the field with its Add button and error.
   *
   * @param {!Object} c The chip.
   * @param {boolean} typing True for the field.
   */
  function paint(c, typing) {
    var box = c.box;
    ui.clear(box);
    if (!typing) {
      box.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'toggle-chip sm add',
            name: c.name + '-add',
            onclick: function () {
              paint(c, true);
              var el = box.querySelector('input');
              if (el?.focus) el.focus();
            }
          },
          '+ New kind'
        )
      );
      return;
    }
    c.err = h('span', { class: 'error', id: c.name + '-err', role: 'alert' });
    c.input = field(c);
    box.appendChild(c.input);
    box.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet sm',
          name: c.name + '-take',
          onclick: go.bind(null, c)
        },
        'Add'
      )
    );
    box.appendChild(c.err);
  }

  /**
   * Draws the "+ New kind" chip.
   *
   * @param {string} name The name its parts are found by.
   * @param {!Array<string>} known The kinds known.
   * @param {function(string)} take Called with the new kind.
   * @return {!Element} The chip.
   */
  L.newKindChip = function (name, known, take) {
    var c = {
      name: name,
      known: known,
      take: take,
      box: h('span', { class: 'sec-new' })
    };
    paint(c, false);
    return c.box;
  };
})(window.App);
