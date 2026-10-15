/**
 * The rules of plain text: Arabic digits read as Latin ones, empty values,
 * Arabic names, English-only titles and email addresses.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;

  /** The Arabic diacritics and the tatweel, removed without a word. */
  var DIACRITICS = /[ً-ٰٟـ]/g;

  /** Anything that is not an Arabic letter or a space. */
  var NOT_ARABIC_LETTER_OR_SPACE = /[^ء-غف-يٱ\s]/g;

  /** Any Arabic letter or sign. */
  var HAS_ARABIC = /[؀-ۿݐ-ݿ]/;

  /** An email address: a name, an @, a domain and a top level of 2+. */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** Each Arabic-Indic digit and the Latin digit it stands for. */
  var ARABIC_DIGITS = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };

  /** The parts an Arabic name needs when the field does not say. */
  var MIN_NAME_PARTS = 4;

  /** The letters a word needs to count as a part of a name. */
  var MIN_PART_LENGTH = 2;

  /** The longest Arabic name. */
  var MAX_NAME_LENGTH = 120;

  /** The shortest English text when the field does not say. */
  var MIN_TEXT_LENGTH = 2;

  /** The longest English text when the field does not say. */
  var MAX_TEXT_LENGTH = 120;

  /** The longest email address the standard allows. */
  var MAX_EMAIL_LENGTH = 254;

  /**
   * Writes Arabic-Indic digits as Latin ones.
   *
   * @param {*} s The text; null and undefined are empty.
   * @return {string} The text with Latin digits.
   */
  function latinDigits(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) {
      return ARABIC_DIGITS[d];
    });
  }

  /**
   * Says whether a value holds nothing: missing, blank text or an empty
   * list.
   *
   * @param {*} v The value.
   * @return {boolean} True when it is empty.
   */
  function isEmpty(v) {
    return (
      v === undefined ||
      v === null ||
      (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0)
    );
  }

  /**
   * Turns every run of spaces into one space and trims the ends.
   *
   * @param {*} s The text; null and undefined are empty.
   * @return {string} The squashed text.
   */
  function squash(s) {
    return String(s == null ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Strips everything that is not an Arabic letter or a space. Diacritics
   * and tatweel are removed silently; anything else counts as blocked.
   * While typing, the trailing space is kept so the next word can follow.
   *
   * @param {*} raw The typed name.
   * @param {boolean=} final True when the name is done, to trim the end.
   * @return {{value: string, blocked: boolean}} The cleaned name, and
   *     whether something other than diacritics was taken out.
   */
  function cleanArabicName(raw, final) {
    var s = String(raw == null ? '' : raw).replace(DIACRITICS, '');
    var cleaned = s.replace(NOT_ARABIC_LETTER_OR_SPACE, '');
    var blocked = cleaned.length !== s.length;
    cleaned = cleaned.replace(/^\s+/, '').replace(/\s+/g, ' ');
    if (final) cleaned = cleaned.trim();
    return { value: cleaned, blocked: blocked };
  }

  /**
   * Counts the words of a name that are long enough to be a part of it.
   *
   * @param {*} value The name.
   * @param {number=} minPartLength The letters a part needs.
   * @return {number} How many parts the name has.
   */
  function arabicNameParts(value, minPartLength) {
    var min = minPartLength || MIN_PART_LENGTH;
    return String(value || '')
      .trim()
      .split(/\s+/)
      .filter(function (p) {
        return p.length >= min;
      }).length;
  }

  /**
   * Checks an Arabic name: Arabic letters only, enough parts, not too long.
   *
   * @param {*} raw The typed name.
   * @param {{minParts: (number|undefined)}=} opts How many parts it needs.
   * @return {!Object} `{ok: true, value}` with the cleaned name, or
   *     `{ok: false, error, params}`.
   */
  function validateArabicName(raw, opts) {
    var o = opts || {};
    var minParts = o.minParts == null ? MIN_NAME_PARTS : o.minParts;
    var c = cleanArabicName(raw, true);
    if (isEmpty(raw)) return { ok: false, error: 'required' };
    if (c.blocked) return { ok: false, error: 'arabic_only' };
    if (!c.value) return { ok: false, error: 'required' };
    if (arabicNameParts(c.value) < minParts) {
      return { ok: false, error: 'arabic_parts', params: { min: minParts } };
    }
    if (c.value.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        error: 'too_long',
        params: { max: MAX_NAME_LENGTH }
      };
    }
    return { ok: true, value: c.value };
  }

  /**
   * Checks English-only text, such as a project or task title.
   *
   * @param {*} raw The typed text.
   * @param {{min: (number|undefined), max: (number|undefined)}=} opts The
   *     shortest and longest length.
   * @return {!Object} `{ok: true, value}` with the squashed text, or
   *     `{ok: false, error, params}`.
   */
  function validateEnglishText(raw, opts) {
    var o = opts || {};
    var v = squash(raw);
    if (!v) return { ok: false, error: 'required' };
    if (HAS_ARABIC.test(v)) return { ok: false, error: 'english_only' };
    var min = o.min || MIN_TEXT_LENGTH;
    var max = o.max || MAX_TEXT_LENGTH;
    if (v.length < min) {
      return { ok: false, error: 'too_short', params: { min: min } };
    }
    if (v.length > max) {
      return { ok: false, error: 'too_long', params: { max: max } };
    }
    return { ok: true, value: v };
  }

  /**
   * Checks an email address, in lower case.
   *
   * @param {*} raw The typed address.
   * @return {!Object} `{ok: true, value}` or `{ok: false, error}`.
   */
  function validateEmail(raw) {
    var v = squash(raw).toLowerCase();
    if (!v) return { ok: false, error: 'required' };
    if (v.length > MAX_EMAIL_LENGTH || !EMAIL.test(v)) {
      return { ok: false, error: 'invalid_email' };
    }
    return { ok: true, value: v };
  }

  var api = {
    latinDigits: latinDigits,
    isEmpty: isEmpty,
    squash: squash,
    cleanArabicName: cleanArabicName,
    arabicNameParts: arabicNameParts,
    validateArabicName: validateArabicName,
    validateEnglishText: validateEnglishText,
    validateEmail: validateEmail
  };
  if (node) module.exports = api;
  root.RulesText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
