/**
 * Builds page elements without a framework: `h` makes an element with its
 * attributes and children, `clear` empties one. Every other part of `App.ui`
 * draws with these.
 */
(function (App) {
  'use strict';

  /** The attributes set as a true or false property, not as text. */
  var FLAGS = ['checked', 'disabled', 'selected', 'hidden', 'readOnly'];

  /**
   * Says whether a value stands for nothing to add.
   *
   * @param {*} v The value.
   * @return {boolean} True for undefined, null and false.
   */
  function isNothing(v) {
    return v === undefined || v === null || v === false;
  }

  /**
   * Sets an attribute that is a property of the element: the class, a
   * style object, data fields or the value.
   *
   * @param {!Element} el The element.
   * @param {string} k The attribute name.
   * @param {*} v The value.
   * @return {boolean} True when it was one of these and is now set.
   */
  function setProperty(el, k, v) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else return false;
    return true;
  }

  /**
   * Sets one attribute of an element: a class, a style object, data
   * fields, an event handler (`onclick`), a value, a flag, or plain text.
   *
   * @param {!Element} el The element.
   * @param {string} k The attribute name.
   * @param {*} v The value; nothing is set for undefined, null or false.
   */
  function setAttr(el, k, v) {
    if (isNothing(v) || setProperty(el, k, v)) return;
    if (k.slice(0, 2) === 'on' && typeof v === 'function') {
      el.addEventListener(k.slice(2), v);
    } else if (FLAGS.indexOf(k) !== -1) {
      if (v) el[k] = true;
    } else el.setAttribute(k, v === true ? '' : v);
  }

  /**
   * Adds children to an element: nodes, text, or arrays of either. Nothing
   * is added for undefined, null or false.
   *
   * @param {!Element} el The element.
   * @param {*} c The child.
   */
  function append(el, c) {
    if (isNothing(c)) return;
    if (Array.isArray(c)) {
      c.forEach(function (x) {
        append(el, x);
      });
    } else if (c.nodeType) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }

  /**
   * Makes an element, as in `h('div', {class: 'x', onclick: fn}, child,
   * 'text', [more])`.
   *
   * @param {string} tag The tag name.
   * @param {?Object} attrs The attributes, or null.
   * @param {...*} children The children.
   * @return {!Element} The element.
   */
  function h(tag, attrs, ...children) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      setAttr(el, k, a[k]);
    });
    append(el, children);
    return el;
  }

  /**
   * Removes every child of an element.
   *
   * @param {!Element} el The element.
   * @return {!Element} The same element, now empty.
   */
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  App.ui = App.ui || {};
  App.ui.h = h;
  App.ui.clear = clear;
})(window.App);
