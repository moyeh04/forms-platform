/**
 * Answers picked from a list: chips for a few choices and a dropdown for many.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  /** The most choices shown as chips; more take a dropdown. */
  var MAX_CHIPS = 4;

  /**
   * Fills in the only possible answer of a required question, such as a
   * form limited to one specialization.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @return {*} The answer now kept.
   */
  function onlyChoice(field, path) {
    var opts = field.options || [];
    var cur = P.getVal(path) || '';
    var only = opts.length === 1 && field.required !== false;
    if (only && String(cur) !== String(opts[0].value)) {
      cur = opts[0].value;
      P.setVal(path, cur);
    }
    return cur;
  }

  /**
   * Keeps a picked answer and clears its error.
   *
   * @param {string} path The path of the answer.
   * @param {*} v The answer.
   */
  function pick(path, v) {
    P.setVal(path, v);
    if (S.errors[path]) {
      delete S.errors[path];
      P.paintError(path);
    }
    P.saveDraft();
  }

  /**
   * Draws a few choices as chips.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the control.
   * @param {*} cur The answer now.
   * @return {!Element} The chips.
   */
  function chips(field, path, id, cur) {
    return h(
      'div',
      {
        class: 'chips',
        role: 'radiogroup',
        id: id,
        'aria-describedby': id + '-err'
      },
      field.options.map(function (o) {
        return h(
          'label',
          { class: 'chip' },
          h('input', {
            type: 'radio',
            name: path,
            value: o.value,
            checked: String(cur) === String(o.value),
            onchange: function () {
              pick(path, o.value);
            }
          }),
          h('span', null, L(o.label))
        );
      })
    );
  }

  /**
   * Draws many choices as a dropdown.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the control.
   * @param {*} cur The answer now.
   * @return {!Element} The dropdown.
   */
  function dropdown(field, path, id, cur) {
    return h(
      'select',
      {
        id: id,
        class: 'select',
        name: path,
        'aria-describedby': id + '-help ' + id + '-err',
        onchange: function (e) {
          pick(path, e.target.value);
        }
      },
      h('option', { value: '' }, t('choose')),
      (field.options || []).map(function (o) {
        return h(
          'option',
          { value: o.value, selected: String(cur) === String(o.value) },
          L(o.label)
        );
      })
    );
  }

  /**
   * Draws a question answered by picking from a list.
   *
   * @param {!Object} field The question.
   * @param {string} path The path of its answer.
   * @param {string} id The id of the control.
   * @return {!Element} Chips for a few choices, a dropdown for more.
   */
  function selectControl(field, path, id) {
    var count = (field.options || []).length;
    var cur = onlyChoice(field, path);
    if (count > 0 && count <= MAX_CHIPS) return chips(field, path, id, cur);
    return dropdown(field, path, id, cur);
  }

  P.selectControl = selectControl;
})(window.App);
