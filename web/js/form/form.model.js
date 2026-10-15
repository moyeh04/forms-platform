/**
 * The state of the student page: the form, the answers typed so far, the step
 * shown, the errors and the key a registration was opened with, with the
 * helpers that read and write an answer by its path. It creates `App.formPage`,
 * which the other parts of the page add their functions to.
 */
(function (App) {
  'use strict';

  var h = App.ui.h;

  var icon = App.ui.icon;

  var t = function (k, p) {
    return App.i18n.t(k, p);
  };

  // The bar about a newer version of the page speaks the language of the form.
  App.fresh.words = function () {
    return { text: t('freshReady'), action: t('freshReload') };
  };

  var L = function (o) {
    return App.i18n.L(o);
  };

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

  function getVal(path) {
    var cur = S.data;
    var parts = path.split('.');
    for (var i = 0; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    return cur;
  }

  function setVal(path, v) {
    var parts = path.split('.');
    var cur = S.data;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null)
        cur[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }

  function activeFields() {
    return (S.form.fields || []).filter(function (f) {
      return f.enabled !== false;
    });
  }

  function fieldById(id) {
    return activeFields().filter(function (f) {
      return f.id === id;
    })[0];
  }

  function slotField() {
    return Rules.fieldByRole(S.form, 'slot');
  }

  /** True while a new booking is made with a registration key instead of typed answers. */
  function keyMode() {
    return !!(S.form && S.form.keyBooking) && S.mode === 'new';
  }

  /** True for a booking opened with its key that may move to another time and change nothing else. */
  function slotOnly() {
    return (
      S.mode === 'edit' && !!(S.keyInfo && S.keyInfo.slotOnly) && !!slotField()
    );
  }

  var P = { h: h, icon: icon, t: t, L: L, root: root, S: S };
  App.formPage = P;

  P.keyMode = keyMode;
  P.slotField = slotField;
  P.activeFields = activeFields;
  P.slotOnly = slotOnly;
  P.getVal = getVal;
  P.setVal = setVal;
})(window.App);
