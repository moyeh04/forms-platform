/**
 * The year and the department letter of a new year group, as chips; a
 * new letter can be typed. The chips read the card object, `dr`, which
 * also gives `redraw` and `paintFoot`.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var h = App.ui.h;

  /** The most letters a typed department letter has. */
  var LETTER_LETTERS = 2;

  /**
   * Draws a chip of a year or a letter; a second press takes it back.
   *
   * @param {!Object} dr The card.
   * @param {string} key year or letter.
   * @param {string} v The value.
   * @return {!Element} The chip.
   */
  function chip(dr, key, v) {
    var d = dr.d;
    return h(
      'button',
      {
        type: 'button',
        class: 'toggle-chip sm',
        name: 'group-' + key + '-' + v,
        'aria-pressed': d[key] === v ? 'true' : 'false',
        onclick: function () {
          if (key === 'letter') d.typing = false;
          d[key] = d[key] === v ? '' : v;
          dr.redraw('group-' + key + '-' + v);
        }
      },
      v
    );
  }

  /**
   * Draws the field of a new letter. Enter moves on to the first count.
   *
   * @param {!Object} dr The card.
   * @return {!Element} The field with its label.
   */
  function letterField(dr) {
    var d = dr.d;
    return h(
      'label',
      { class: 'sec-new' },
      h('span', { class: 'tool-label' }, 'New letter'),
      h('input', {
        class: 'input sec-letter',
        name: 'group-letter-new',
        maxlength: String(LETTER_LETTERS),
        placeholder: 'M',
        'aria-label': 'New department letter',
        autocomplete: 'off',
        value: d.letter,
        oninput: function (e) {
          d.letter = L.cleanCode(e.target.value, LETTER_LETTERS);
          e.target.value = d.letter;
          dr.paintFoot();
        },
        onkeydown: function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          var first = dr.card.querySelector('.stepper-input');
          if (first?.focus) first.focus();
        }
      })
    );
  }

  /**
   * Draws the chip that opens the field of a new letter, or the field.
   *
   * @param {!Object} dr The card.
   * @return {!Element} The chip or the field.
   */
  function letterBox(dr) {
    if (dr.d.typing) return letterField(dr);
    return h(
      'button',
      {
        type: 'button',
        class: 'toggle-chip sm add',
        name: 'group-letter-add',
        onclick: function () {
          dr.d.letter = '';
          dr.d.typing = true;
          dr.redraw('group-letter-new');
        }
      },
      '+ New letter'
    );
  }

  /**
   * Draws a row of chips with its label.
   *
   * @param {string} label The label.
   * @param {!Array<!Element>} chips The chips.
   * @return {!Element} The row.
   */
  function pickRow(label, chips) {
    return h(
      'div',
      { class: 'sec-pick' },
      h('span', { class: 'label' }, label),
      h('div', { class: 'toggle-chips' }, chips)
    );
  }

  /**
   * Draws the year and letter rows of the new group. A typed letter not
   * yet in a list shows as a chip of its own once typing ends.
   *
   * @param {!Object} dr The card.
   * @param {!Object} parts The kinds, letters and years in use.
   * @return {!Array<!Element>} The two rows.
   */
  L.draftPicks = function (dr, parts) {
    var d = dr.d;
    var letters = parts.letters.concat(
      d.typing || !d.letter || parts.letters.indexOf(d.letter) !== -1
        ? []
        : [d.letter]
    );
    return [
      pickRow('Year', parts.years.map(chip.bind(null, dr, 'year'))),
      pickRow(
        'Department letter',
        letters.map(chip.bind(null, dr, 'letter')).concat(letterBox(dr))
      )
    ];
  };
})(window.App);
