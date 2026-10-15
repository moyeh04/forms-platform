/**
 * How long a key or a private link works, as the dashboard shows and asks
 * it. One picker serves the Clients page, a registration's details and the
 * Extend keys dialog, so the three read the same way.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Writes where a key or a link ends: "Until 14 Oct 2026", "Ended 2 Oct
   * 2026" (marked), or the words for no end.
   *
   * @param {string} iso The end, or '' for none.
   * @param {string=} none The words for no end.
   * @return {!Element} The line.
   */
  A.untilText = function (iso, none) {
    if (!iso) return h('span', { class: 'until' }, none || 'No end date');
    return A.ended(iso)
      ? h('span', { class: 'until warn-text' }, 'Ended ' + A.day(iso))
      : h('span', { class: 'until' }, 'Until ' + A.day(iso));
  };

  /**
   * Draws a chip of the picker.
   *
   * @param {!Object} p The picker.
   * @param {string} name The end of its name.
   * @param {string} text Its words.
   * @param {function()} pick What picking it does.
   * @return {!Element} The chip.
   */
  function chip(p, name, text, pick) {
    return h(
      'button',
      {
        type: 'button',
        class: 'toggle-chip',
        name: p.opts.name + '-' + name,
        onclick: pick
      },
      text
    );
  }

  /**
   * Says whether a chip is the one picked.
   *
   * @param {!Object} p The picker.
   * @param {string} name The end of the chip's name.
   * @return {boolean} True when it is.
   */
  function isOn(p, name) {
    var c = p.choice;
    if (name === 'date') return p.picking;
    if (p.picking || !c) return false;
    if (name === 'none') return !!c.none;
    return String(c.days) === name;
  }

  /**
   * Marks the chip picked and shows the date box while a date is asked.
   *
   * @param {!Object} p The picker.
   */
  function paint(p) {
    Array.prototype.forEach.call(p.chips.children, function (c) {
      var name = c.name.slice(p.opts.name.length + 1);
      c.setAttribute('aria-pressed', isOn(p, name) ? 'true' : 'false');
    });
    p.date.hidden = !p.picking;
  }

  /**
   * Keeps a new choice, marks it and reports it.
   *
   * @param {!Object} p The picker.
   * @param {?Object} choice The choice, or null while no date is picked.
   * @param {boolean} picking True while a date is asked.
   */
  function choose(p, choice, picking) {
    p.choice = choice;
    p.picking = picking;
    paint(p);
    if (p.opts.onchange) p.opts.onchange(choice);
  }

  /**
   * Gives the choice the date box holds.
   *
   * @param {!Object} p The picker.
   * @return {?Object} `{until}`, or null while it is empty.
   */
  function dateChoice(p) {
    return p.date.value ? { until: A.endOfDay(p.date.value) } : null;
  }

  /**
   * Draws the chips: no end when offered, each period, and Pick a date.
   *
   * @param {!Object} p The picker.
   */
  function addChips(p) {
    if (p.opts.none) {
      p.chips.appendChild(
        chip(p, 'none', p.opts.none, function () {
          choose(p, { none: true }, false);
        })
      );
    }
    p.opts.periods.forEach(function (period) {
      p.chips.appendChild(
        chip(p, String(period.days), period.label, function () {
          choose(p, { days: period.days }, false);
        })
      );
    });
    p.chips.appendChild(
      chip(p, 'date', 'Pick a date', function () {
        choose(p, dateChoice(p), true);
        p.date.focus();
      })
    );
  }

  /**
   * Draws chips for how long, plus "Pick a date" with a date box. The
   * choice is `{days: n}`, `{until: iso}` or `{none: true}`; null while a
   * date is not picked yet.
   *
   * @param {!Object} opts `name` (the start of each control's name),
   *     `periods` (each `{days, label}`), `none` (the words of a "no end"
   *     chip, or empty), `start` (the first choice) and `onchange(choice)`.
   * @return {{node: !Element, value: function(): ?Object}} The picker.
   */
  A.untilPicker = function (opts) {
    var p = { opts: opts, choice: opts.start || null };
    p.picking = !!p.choice?.until;
    p.chips = h('div', {
      class: 'toggle-chips',
      role: 'group',
      'aria-label': 'How long'
    });
    p.date = h('input', {
      class: 'input until-date',
      type: 'date',
      name: opts.name + '-until',
      min: A.dateValue(new Date(Date.now() + A.DAY_MS)),
      'aria-label': 'End date',
      oninput: function () {
        choose(p, dateChoice(p), p.picking);
      }
    });
    if (p.picking) p.date.value = A.dateValue(new Date(p.choice.until));
    addChips(p);
    paint(p);

    /**
     * Gives the choice picked now.
     *
     * @return {?Object} The choice.
     */
    function value() {
      return p.choice;
    }

    return {
      node: h('div', { class: 'until-picker' }, p.chips, p.date),
      value: value
    };
  };
})(window.App);
