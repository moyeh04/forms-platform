/**
 * A range of whole numbers that students choose from: the size of a team,
 * or how many teammates come with the leader of a booking. Both use this
 * one control, so they look and check the same: the lowest and the
 * highest, the numbers students will see, the saved answers a new range
 * leaves outside, and a note shown to students who pick some of the
 * numbers.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    A = App.admin;

  /**
   * Reads the lowest and the highest number as typed.
   *
   * @param {!Object} range The range.
   * @return {{min: number, max: number}} The bounds; NaN when not a number.
   */
  function bounds(range) {
    return { min: parseInt(range.min, 10), max: parseInt(range.max, 10) };
  }

  /**
   * Tells whether the bounds can be saved.
   *
   * @param {!Object} c The control.
   * @param {{min: number, max: number}} b The bounds.
   * @return {boolean} True when they are inside the floor and the ceiling.
   */
  function valid(c, b) {
    return (
      b.min >= c.o.floor && b.max >= Math.max(b.min, 1) && b.max <= c.o.ceiling
    );
  }

  /**
   * Says which bounds can be saved.
   *
   * @param {!Object} o The options of the control.
   * @return {string} The rule.
   */
  function ruleOf(o) {
    return (
      o.words.name +
      ' needs a minimum of at least ' +
      o.floor +
      ' and a maximum that is not lower' +
      (o.floor < 1 ? ' and at least 1' : '') +
      ', up to ' +
      o.ceiling +
      '.'
    );
  }

  /**
   * Lists the numbers of the range.
   *
   * @param {{min: number, max: number}} b The bounds.
   * @return {!Array<number>} The numbers, lowest first.
   */
  function numbers(b) {
    var out = [];
    var n;
    for (n = b.min; n <= b.max; n++) out.push(n);
    return out;
  }
  A.rangeNumbers = numbers;

  /**
   * Draws the numbers students will see, or the rule while the bounds are
   * refused.
   *
   * @param {!Object} c The control.
   * @param {{min: number, max: number}} b The bounds.
   */
  function paintChoices(c, b) {
    var w = c.o.words;
    ui.clear(c.choices);
    if (!valid(c, b)) {
      c.choices.appendChild(h('span', { class: 'muted-note' }, c.rule));
      return;
    }
    c.choices.appendChild(h('span', { class: 'muted-note' }, w.choose + ': '));
    numbers(b).forEach(function (n) {
      c.choices.appendChild(h('span', { class: 'num-chip' }, String(n)));
    });
    if (w.unit) {
      c.choices.appendChild(h('span', { class: 'muted-note' }, ' ' + w.unit));
    }
  }

  /**
   * Says how many saved answers a new range leaves outside, and what to do.
   *
   * @param {!Object} w The words of the control.
   * @param {{min: number, max: number}} b The bounds.
   * @param {number} n How many are outside; more than 0.
   * @return {string} The banner.
   */
  function outsideText(w, b, n) {
    var one = n === 1;
    return (
      A.plural(n, w.one + ' is', w.many + ' are') +
      ' outside ' +
      (b.min === b.max ? String(b.min) : b.min + ' to ' + b.max) +
      '. ' +
      (one ? 'It stays ' : 'They stay ') +
      w.stay +
      ' as ' +
      (one ? 'it is' : 'they are') +
      '. Widen the range, or ask ' +
      (one ? 'that team' : 'those teams') +
      ' ' +
      w.fix +
      '.'
    );
  }

  /**
   * Draws the banner about the answers saved earlier that a new range
   * leaves outside. They keep their number; they are counted here, before
   * the save.
   *
   * @param {!Object} c The control.
   * @param {{min: number, max: number}} b The bounds.
   */
  function paintOutside(c, b) {
    var counts = c.o.counts || {};
    var n = 0;
    if (valid(c, b)) {
      n = Object.keys(counts).reduce(function (sum, k) {
        return +k >= b.min && +k <= b.max ? sum : sum + counts[k];
      }, 0);
    }
    c.outside.hidden = !n;
    c.outside.textContent = n ? outsideText(c.o.words, b, n) : '';
  }

  /**
   * Draws the input of one bound.
   *
   * @param {!Object} c The control.
   * @param {string} key 'min' or 'max'.
   * @return {!Element} The field.
   */
  function boundField(c, key) {
    var input = A.number(
      c.range[key],
      function (v) {
        c.range[key] = v;
        c.paint();
      },
      {
        name: c.o.names[key],
        min: String(c.o.floor),
        max: String(c.o.ceiling)
      }
    );
    return A.field(c.o.words[key], input);
  }

  /**
   * Says why the range cannot be saved.
   *
   * @param {!Object} c The control.
   * @return {string} The reason, or ''.
   */
  function problemOf(c) {
    var text = c.notice.text;
    if (!valid(c, bounds(c.range))) return c.rule;
    if (
      c.notice.sizes.length &&
      !(text.en || '').trim() &&
      !(text.ar || '').trim()
    ) {
      return (
        'Write the note for ' +
        c.o.words.name.toLowerCase() +
        ', or switch off its numbers.'
      );
    }
    return '';
  }

  /**
   * Draws everything that follows the bounds again.
   *
   * @param {!Object} c The control.
   */
  function paint(c) {
    var b = bounds(c.range);
    paintChoices(c, b);
    paintOutside(c, b);
    A.paintRangeNote(c, valid(c, b) ? b : null);
  }

  /**
   * Fills in the note of a range when it has none.
   *
   * @param {!Object} range The range, changed in place.
   * @return {!Object} Its note.
   */
  function noticeOf(range) {
    range.notice = range.notice || { sizes: [], text: { en: '', ar: '' } };
    range.notice.text = range.notice.text || { en: '', ar: '' };
    return range.notice;
  }

  /**
   * Draws the control of a range.
   *
   * @param {!Object} range `min`, `max` and `notice` of the form, changed
   *     in place; notice is `{sizes, text: {en, ar}}`.
   * @param {!Object} o `floor` and `ceiling` bound the range; `counts` is
   *     {number: saved answers with it}; `names` holds the names of the
   *     inputs and the banner (`min`, `max`, `outside`, and `note`, a
   *     prefix for the note inputs); `words` holds its texts (`name`, `min`,
   *     `max`, `choose`, `unit`, `who`, `one`, `many`, `stay`, `fix`,
   *     `note`, `noteFor`, `noteHelp`, `placeholder: {en, ar}`).
   * @return {!Object} `node`, and `problem()`: the reason the range cannot
   *     be saved, or ''.
   */
  A.sizeRange = function (range, o) {
    var c = {
      range: range,
      o: o,
      notice: noticeOf(range),
      rule: ruleOf(o),
      choices: h('div', { class: 'size-preview', 'aria-live': 'polite' }),
      outside: h('div', {
        class: 'banner',
        role: 'alert',
        name: o.names.outside,
        hidden: true
      }),
      noteChips: h('div', {
        class: 'toggle-chips',
        role: 'group',
        'aria-label': o.words.noteFor
      }),
      notePreview: h('div', { class: 'notice-preview', 'aria-live': 'polite' })
    };
    c.paint = paint.bind(null, c);
    var node = h(
      'div',
      { class: 'size-range l-stack' },
      h('div', { class: 'row' }, boundField(c, 'min'), boundField(c, 'max')),
      c.choices,
      c.outside,
      A.rangeNoteBox(c)
    );
    c.paint();

    return { node: node, problem: problemOf.bind(null, c) };
  };
})(window.App);
