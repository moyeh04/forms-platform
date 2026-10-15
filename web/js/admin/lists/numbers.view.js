/**
 * The editor of a number list: a run from one number to another, each
 * end with its stepper.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = A.lists;
  var h = App.ui.h;

  /** The most numbers a run holds past its first. */
  var MAX_RUN = 300;
  /** The highest first number. */
  var MAX_FROM = 999;

  /**
   * Whether the rows are a run of whole numbers, each one more than the
   * last.
   *
   * @param {!Object} p The page.
   * @param {!Array<number>} nums The rows as numbers.
   * @return {boolean} True for a run.
   */
  function isRun(p, nums) {
    return (
      nums.length > 0 &&
      nums.every(function (n, i) {
        return (
          !Number.isNaN(n) &&
          String(n) === p.rows[i].value &&
          (i === 0 || n === nums[i - 1] + 1)
        );
      })
    );
  }

  /**
   * Sets the rows to the run from one number to another.
   *
   * @param {!Object} p The page.
   * @param {number} a The first number.
   * @param {number} b The last number; below the first, it is the first.
   */
  function setRun(p, a, b) {
    var last = Math.max(a, b);
    var out = [];
    var n;
    for (n = a; n <= last && out.length <= MAX_RUN; n++) out.push(String(n));
    p.setRows(L.plainRows(out));
  }

  /**
   * Draws a label with its stepper.
   *
   * @param {string} label The label.
   * @param {!Element} stepper The stepper.
   * @return {!Element} The row.
   */
  function fieldRow(label, stepper) {
    return h(
      'div',
      { class: 'field-row' },
      h('span', { class: 'label' }, label),
      stepper
    );
  }

  /**
   * Draws the editor of a number list, or nothing when its values are
   * not a run, so the choices editor shows them instead.
   *
   * @param {!Object} p The page.
   * @return {?Element} The editor.
   */
  L.numbersEditor = function (p) {
    var nums = p.rows.map(function (r) {
      return parseInt(r.value, 10);
    });
    if (p.rows.length && !isRun(p, nums)) return null;
    var from = nums.length ? nums[0] : 1;
    var to = nums.length ? nums[nums.length - 1] : 1;
    return h(
      'div',
      { class: 'num-editor' },
      h(
        'div',
        { class: 'num-run' },
        fieldRow(
          'From',
          L.stepper({
            name: 'range-from',
            label: 'First number',
            value: from,
            lo: 0,
            hi: MAX_FROM,
            set: function (v) {
              setRun(p, v, Math.max(v, to));
            }
          })
        ),
        fieldRow(
          'To',
          L.stepper({
            name: 'range-to',
            label: 'Last number',
            value: to,
            lo: from,
            hi: from + MAX_RUN,
            set: function (v) {
              setRun(p, from, v);
            }
          })
        )
      ),
      h(
        'p',
        { class: 'muted-note' },
        A.plural(p.rows.length, 'choice', 'choices') +
          ': ' +
          (p.rows.length ? from + ' to ' + to : 'none')
      )
    );
  };
})(window.App);
