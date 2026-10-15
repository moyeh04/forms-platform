/**
 * The state of the student page: the form, the answers typed so far, the step
 * shown, the errors and the key a registration was opened with, with the
 * helpers that read and write an answer by its path. It creates `App.formPage`,
 * which the other parts of the page add their functions to.
 */
(function (App) {
  'use strict';

  /**
   * Gives the page text of a key in the page language.
   *
   * @param {string} k The key.
   * @param {?Object=} p The values to put in.
   * @return {string} The text.
   */
  function t(k, p) {
    return App.i18n.t(k, p);
  }

  /**
   * Picks the text of a `{en, ar}` label in the page language.
   *
   * @param {*} o The label.
   * @return {string} The text.
   */
  function L(o) {
    return App.i18n.L(o);
  }

  var root = document.getElementById('app');

  var S = {
    slug: '',
    form: null,
    state: '',
    taken: {},
    view: 'loading',
    loadError: '',
    steps: [],
    stepIndex: 0,
    data: {},
    errors: {},
    banner: null,
    busy: false,
    mode: 'new',
    key: '',
    keyInfo: null,
    ownSlot: '',
    result: null,
    keyError: '',
    team: null,
    teamBooked: false,
    teamSlot: null,
    teamCanMove: false,
    sourceKey: '',
    teamKey: '',
    teamError: ''
  };

  /**
   * Reads an answer by its path, such as 'members.0.name'.
   *
   * @param {string} path The path.
   * @return {*} The answer, or undefined.
   */
  function getVal(path) {
    return path.split('.').reduce(function (cur, part) {
      return cur == null ? cur : cur[part];
    }, S.data);
  }

  /**
   * Writes an answer by its path, making the lists and objects on the way.
   *
   * @param {string} path The path.
   * @param {*} v The answer.
   */
  function setVal(path, v) {
    var parts = path.split('.');
    var last = parts.pop();
    var cur = parts.reduce(function (obj, part, i) {
      var below = i + 1 < parts.length ? parts[i + 1] : last;
      if (obj[part] == null) obj[part] = /^\d+$/.test(below) ? [] : {};
      return obj[part];
    }, S.data);
    cur[last] = v;
  }

  /**
   * Lists the questions of the form that are switched on.
   *
   * @return {!Array<!Object>} The fields.
   */
  function activeFields() {
    return (S.form.fields || []).filter(function (f) {
      return f.enabled !== false;
    });
  }

  /**
   * Finds the slot question of the form.
   *
   * @return {?Object} The field, or null.
   */
  function slotField() {
    return Rules.fieldByRole(S.form, 'slot');
  }

  /**
   * Says whether a new booking is made with a registration key instead of
   * typed answers.
   *
   * @return {boolean} True in that case.
   */
  function keyMode() {
    return !!S.form?.keyBooking && S.mode === 'new';
  }

  /**
   * Says whether a booking opened with its key may move to another time
   * and change nothing else.
   *
   * @return {boolean} True in that case.
   */
  function slotOnly() {
    return S.mode === 'edit' && !!S.keyInfo?.slotOnly && !!slotField();
  }

  App.formPage = {
    t: t,
    L: L,
    root: root,
    S: S,
    keyMode: keyMode,
    slotField: slotField,
    activeFields: activeFields,
    slotOnly: slotOnly,
    getVal: getVal,
    setVal: setVal
  };
})(window.App);
