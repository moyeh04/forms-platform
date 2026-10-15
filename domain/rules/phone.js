/**
 * The rules of Egyptian mobile numbers: one canonical form, the WhatsApp
 * chat of a number, and the numbers inside pasted text.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var textRules = node ? require('./text.js') : root.RulesText;

  /** The country code of Egypt. */
  var COUNTRY_CODE = '20';

  /** The length of a number written with the country code and no 0. */
  var INTERNATIONAL_LENGTH = 12;

  /** The length of a number written without its leading 0. */
  var BARE_LENGTH = 10;

  /** A canonical Egyptian mobile number: 01, a network digit, 8 digits. */
  var MOBILE = /^01[0125]\d{8}$/;

  /** Something in free text that may be a phone number. */
  var PHONE_LIKE = /\+?\d[\d\s().-]{8,}\d/g;

  /** The address of a WhatsApp chat, before the number without its 0. */
  var WHATSAPP = 'https://wa.me/2';

  /**
   * Gives the canonical Egyptian mobile (01XXXXXXXXX) of a typed number.
   *
   * @param {*} raw The typed number, in any common way of writing it.
   * @return {string} The canonical number, or '' when it is not one.
   */
  function normalizePhone(raw) {
    var d = textRules.latinDigits(raw).replace(/[^\d+]/g, '');
    if (!d) return '';
    d = d.replace(/^\+/, '').replace(/^00/, '');
    if (d.indexOf(COUNTRY_CODE) === 0 && d.length === INTERNATIONAL_LENGTH) {
      d = '0' + d.slice(COUNTRY_CODE.length);
    } else if (d.length === BARE_LENGTH && d.charAt(0) === '1') {
      d = '0' + d;
    }
    return MOBILE.test(d) ? d : '';
  }

  /**
   * Gives the WhatsApp chat of an Egyptian mobile number.
   *
   * @param {*} raw The typed number.
   * @return {string} The address of the chat, or '' when it is not one.
   */
  function whatsappLink(raw) {
    var p = normalizePhone(raw);
    return p ? WHATSAPP + p : '';
  }

  /**
   * Finds every Egyptian mobile number inside free text, such as a pasted
   * WhatsApp line.
   *
   * @param {*} text The text.
   * @return {!Array<{raw: string, phone: string}>} Each number as written
   *     and in its canonical form, in the order they come.
   */
  function extractPhones(text) {
    var found = [];
    (textRules.latinDigits(text).match(PHONE_LIKE) || []).forEach(
      function (raw) {
        var p = normalizePhone(raw);
        if (p) found.push({ raw: raw, phone: p });
      }
    );
    return found;
  }

  /**
   * Checks a phone field.
   *
   * @param {*} raw The typed number.
   * @return {!Object} `{ok: true, value}` with the canonical number, or
   *     `{ok: false, error}`.
   */
  function validatePhone(raw) {
    if (textRules.isEmpty(raw)) return { ok: false, error: 'required' };
    var p = normalizePhone(raw);
    return p ? { ok: true, value: p } : { ok: false, error: 'invalid_phone' };
  }

  var api = {
    normalizePhone: normalizePhone,
    whatsappLink: whatsappLink,
    extractPhones: extractPhones,
    validatePhone: validatePhone
  };
  if (node) module.exports = api;
  root.RulesPhone = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
