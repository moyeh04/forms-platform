/**
 * The rule of student codes: digits only, of the length the field asks.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var textRules = node ? require('./text.js') : root.RulesText;

  /** The digits of a student code when the field does not say. */
  var CODE_LENGTH = 7;

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

  var api = { codeLength: codeLength, validateCode: validateCode };
  if (node) module.exports = api;
  root.RulesCodes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
