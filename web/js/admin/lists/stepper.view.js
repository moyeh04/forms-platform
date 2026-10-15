/**
 * A number with − and + buttons around its field: typing is possible,
 * never needed. The stepper keeps its own buttons and field up to date,
 * so `set` may redraw the page or not.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var h = App.ui.h;

  /**
   * Takes a number, kept within the bounds, and shows it.
   *
   * @param {!Object} c The stepper: options, value, field and buttons.
   * @param {number} v The number.
   */
  function take(c, v) {
    var n = Math.max(c.o.lo, Math.min(c.o.hi, v));
    c.value = n;
    c.input.value = String(n);
    c.down.disabled = n <= c.o.lo;
    c.up.disabled = n >= c.o.hi;
    c.o.set(n);
  }

  /**
   * Takes the number typed, or keeps the last one when it is not a
   * number.
   *
   * @param {!Object} c The stepper.
   */
  function typed(c) {
    var v = parseInt(c.input.value, 10);
    take(c, Number.isNaN(v) ? c.value : v);
  }

  /**
   * Draws the field of the stepper.
   *
   * @param {!Object} c The stepper.
   * @return {!Element} The field.
   */
  function field(c) {
    var o = c.o;
    return h('input', {
      class: 'input num stepper-input',
      type: 'number',
      inputmode: 'numeric',
      name: o.name,
      min: String(o.lo),
      max: String(o.hi),
      value: String(c.value),
      'aria-label': o.label,
      onchange: typed.bind(null, c),
      // The number is typed over, not added to.
      onfocus: function (e) {
        if (e.target.select) e.target.select();
      },
      onkeydown: function (e) {
        if (e.key === 'Enter' && o.enter) {
          e.preventDefault();
          typed(c);
          o.enter();
        }
      }
    });
  }

  /**
   * Draws a button that moves the number by one.
   *
   * @param {!Object} c The stepper.
   * @param {number} by -1 or 1.
   * @return {!Element} The button.
   */
  function stepButton(c, by) {
    var o = c.o;
    var down = by < 0;
    return h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: o.name + (down ? '-down' : '-up'),
        'aria-label': (down ? 'Fewer: ' : 'More: ') + o.label,
        disabled: down ? c.value <= o.lo : c.value >= o.hi,
        onclick: function () {
          take(c, c.value + by);
        }
      },
      down ? '−' : '+'
    );
  }

  /**
   * Draws a stepper.
   *
   * @param {{name: string, label: string, value: number, lo: number,
   *     hi: number, set: function(number), enter: (function()|undefined)}} o
   *     Its name, label, number, bounds, what takes a new number, and what
   *     Enter in the field does after the typed number is taken.
   * @return {!Element} The stepper.
   */
  L.stepper = function (o) {
    var c = { o: o, value: o.value };
    c.input = field(c);
    c.down = stepButton(c, -1);
    c.up = stepButton(c, 1);
    return h('span', { class: 'stepper' }, c.down, c.input, c.up);
  };
})(window.App);
