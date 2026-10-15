/**
 * English by default, Arabic on request. The page text comes from
 * `App.strings`, which en.js and ar.js fill before this file; form
 * questions carry their own `{en, ar}` labels.
 */
(function (App) {
  'use strict';

  var STR = App.strings;

  /** The browser storage key of the language a visitor chose. */
  var KEY = 'fp_lang';

  /** The length of the date part of an ISO date and time. */
  var ISO_DATE_LENGTH = 10;

  var lang = 'en';

  /**
   * Finds the browser storage, which a locked-down browser may refuse.
   *
   * @return {?Storage} The storage, or null.
   */
  function store() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  /**
   * Puts values in a text: {name} becomes `params.name`. A name without a
   * value stays as it is.
   *
   * @param {*} s The text.
   * @param {?Object} params The values.
   * @return {string} The text with the values in.
   */
  function fill(s, params) {
    var p = params || {};
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return p[k] != null ? p[k] : m;
    });
  }

  /**
   * Follows a dotted key through one language's text.
   *
   * @param {!Object} table The text of one language.
   * @param {!Array<string>} parts The parts of the key.
   * @return {*} The text, or undefined when the key is missing.
   */
  function walk(table, parts) {
    var cur = table;
    parts.forEach(function (part) {
      var here = cur || {};
      cur = here[part];
    });
    return cur;
  }

  /**
   * Finds the text of a key in the page language, then in English.
   *
   * @param {string} path The dotted key, such as 'errors.server_error'.
   * @return {*} The text, or the key itself when neither has it.
   */
  function lookup(path) {
    var parts = path.split('.');
    var cur = walk(STR[lang], parts);
    if (cur === undefined) cur = walk(STR.en, parts);
    return cur === undefined ? path : cur;
  }

  /**
   * Changes the page language and its direction.
   *
   * @param {string} l 'ar' for Arabic; anything else is English.
   * @param {boolean=} remember True to keep the choice on this device.
   */
  function setLang(l, remember) {
    lang = l === 'ar' ? 'ar' : 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var s = store();
    if (remember && s) s.setItem(KEY, lang);
  }

  /**
   * Reads the language kept on this device.
   *
   * @return {?string} The language, or null.
   */
  function saved() {
    var s = store();
    return s ? s.getItem(KEY) : null;
  }

  /**
   * Gives the text of a key with its values in.
   *
   * @param {string} key The dotted key.
   * @param {?Object=} params The values.
   * @return {string} The text.
   */
  function t(key, params) {
    return fill(lookup(key), params);
  }

  /**
   * Picks the right text from a `{en, ar}` label.
   *
   * @param {*} obj The label, or plain text.
   * @return {string} The text in the page language, or the other one.
   */
  function label(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.ar || '';
  }

  /**
   * Turns a coded error `{error, params}` into a sentence.
   *
   * @param {?Object} e The error.
   * @return {string} The sentence, or '' without an error.
   */
  function err(e) {
    if (!e) return '';
    var code = e.error || e.code || 'server_error';
    var params = Object.assign({}, e.params);
    return fill(lookup('errors.' + code), params);
  }

  /**
   * Writes a date the way the page language does, such as 5 Mar 2026.
   *
   * @param {*} iso The date.
   * @return {string} The date, or the input as text when it is not one.
   */
  function fmtDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || '');
    try {
      return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return d.toISOString().slice(0, ISO_DATE_LENGTH);
    }
  }

  App.i18n = {
    /**
     * Gives the page language.
     *
     * @return {string} 'en' or 'ar'.
     */
    get lang() {
      return lang;
    },
    set: setLang,
    saved: saved,
    t: t,
    L: label,
    err: err,
    fmtDate: fmtDate
  };
})(window.App);
