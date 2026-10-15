/**
 * The rules of codes and keys: a student code is digits only, of the length
 * the field asks; a registration key has five digits.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var textRules = node ? require('./text.js') : root.RulesText;

  /** The digits of a student code when the field does not say. */
  var CODE_LENGTH = 7;

  /** The digits of the key a student opens a registration with. */
  var EDIT_KEY_DIGITS = 5;

  /** A whole registration key. */
  var EDIT_KEY = new RegExp('^\\d{' + EDIT_KEY_DIGITS + '}$');

  /**
   * Gives the digits a student code question asks for.
   *
   * @param {?Object} field The question, with its optional `length`.
   * @return {number} The digits.
   */
  function codeLength(field) {
    var f = field || {};
    return f.length || CODE_LENGTH;
  }

  /**
   * Checks a student code, with Arabic digits read as Latin ones and the
   * spaces taken out.
   *
   * @param {*} raw The typed code.
   * @param {{length: (number|undefined)}=} opts The digits it needs.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error, params}`.
   */
  function validateCode(raw, opts) {
    var o = opts || {};
    var len = codeLength(o);
    var v = textRules.latinDigits(raw).replace(/\s+/g, '');
    if (!v) return { ok: false, error: 'required' };
    if (!/^\d+$/.test(v) || v.length !== len) {
      return { ok: false, error: 'invalid_code', params: { length: len } };
    }
    return { ok: true, value: v };
  }

  /**
   * Gives the digits of a registration key, so the page that asks for it
   * and the backend that makes it agree.
   *
   * @return {number} The digits.
   */
  function editKeyDigits() {
    return EDIT_KEY_DIGITS;
  }

  /**
   * Says whether a text is a whole registration key.
   *
   * @param {*} key The text.
   * @return {boolean} True for five digits.
   */
  function isEditKey(key) {
    return EDIT_KEY.test(key);
  }

  var api = {
    codeLength: codeLength,
    validateCode: validateCode,
    editKeyDigits: editKeyDigits,
    isEditKey: isEditKey
  };
  if (node) module.exports = api;
  root.RulesCodes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
