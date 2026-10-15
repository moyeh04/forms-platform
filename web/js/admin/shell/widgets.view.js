/**
 * The small controls every dashboard screen is built from: a badge, a
 * labelled field, a checkbox, a text box, a number box and a dropdown.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Draws a badge, such as the status of a form.
   *
   * @param {string} text Its words.
   * @param {string=} kind Its look; the words in lower case when absent.
   * @return {!Element} The badge.
   */
  A.badge = function (text, kind) {
    return h(
      'span',
      { class: 'badge ' + (kind || String(text).toLowerCase()) },
      text
    );
  };

  /**
   * Draws a control with its label and a help line.
   *
   * @param {string} label The label.
   * @param {!Element} control The control.
   * @param {string=} help The help line.
   * @return {!Element} The field.
   */
  A.field = function (label, control, help) {
    return h(
      'label',
      { class: 'field-row' },
      h('span', { class: 'label' }, label),
      control,
      help ? h('span', { class: 'help' }, help) : null
    );
  };

  /**
   * Draws a checkbox with its label.
   *
   * @param {*} label The label.
   * @param {boolean} checked True when it starts ticked.
   * @param {function(boolean)} onchange Called with the new value.
   * @param {{disabled: (boolean|undefined), name: (string|undefined)}=} opts
   *     Whether it is greyed out, and its name.
   * @return {!Element} The checkbox.
   */
  A.check = function (label, checked, onchange, opts) {
    var o = opts || {};
    return h(
      'label',
      { class: 'check' },
      h('input', {
        type: 'checkbox',
        name: o.name || null,
        checked: !!checked,
        disabled: !!o.disabled,
        onchange: function (e) {
          onchange(e.target.checked);
        }
      }),
      label
    );
  };

  /**
   * Draws an input box that reports each change.
   *
   * @param {string} type The kind of box.
   * @param {*} value Its value.
   * @param {function(string)} onchange Called with each new value.
   * @param {!Object=} attrs Its other attributes.
   * @return {!Element} The box.
   */
  function box(type, value, onchange, attrs) {
    return h(
      'input',
      Object.assign(
        {
          class: 'input',
          type: type,
          value: value == null ? '' : value,
          oninput: function (e) {
            onchange(e.target.value);
          }
        },
        attrs || {}
      )
    );
  }

  /**
   * Draws a text box.
   *
   * @param {*} value Its value.
   * @param {function(string)} onchange Called with each new value.
   * @param {!Object=} attrs Its other attributes.
   * @return {!Element} The box.
   */
  A.text = function (value, onchange, attrs) {
    return box('text', value, onchange, attrs);
  };

  /**
   * Draws a number box with the number keyboard on phones.
   *
   * @param {*} value Its value.
   * @param {function(string)} onchange Called with each new value.
   * @param {!Object=} attrs Its other attributes.
   * @return {!Element} The box.
   */
  A.number = function (value, onchange, attrs) {
    return box(
      'number',
      value,
      onchange,
      Object.assign({ inputmode: 'numeric' }, attrs || {})
    );
  };

  /**
   * Draws a dropdown.
   *
   * @param {*} value The value picked.
   * @param {!Array<*>} options Each a value, or a `[value, label]` pair.
   * @param {function(string)} onchange Called with the new value.
   * @return {!Element} The dropdown.
   */
  A.select = function (value, options, onchange) {
    return h(
      'select',
      {
        class: 'select',
        onchange: function (e) {
          onchange(e.target.value);
        }
      },
      options.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o;
        var l = Array.isArray(o) ? o[1] : o;
        return h(
          'option',
          { value: v, selected: String(v) === String(value) },
          l
        );
      })
    );
  };
})(window.App);
