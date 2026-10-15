/**
 * The steps of a form: which questions each step asks, its title, and the step
 * a question is on.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  /** The title of a step the form did not name. */
  var DETAILS = { en: 'Details', ar: 'البيانات' };

  /** Sets the steps of a key booking: the team, the slot, the review. */
  function buildKeySteps() {
    var sf = P.slotField();
    var def = (S.form.steps || []).filter(function (s) {
      return s.fields.indexOf(sf.id) !== -1;
    })[0];
    S.steps = [
      { id: '_team', team: true, fields: [] },
      { id: 'slot', title: def ? def.title : sf.label, fields: [sf] },
      { id: '_review', review: true, fields: [] }
    ];
  }

  /**
   * Gives the steps the form defines, or one step with every question.
   *
   * @param {!Array<!Object>} fields The questions that are on.
   * @return {!Array<!Object>} The step definitions.
   */
  function stepDefs(fields) {
    if (S.form.steps?.length) return S.form.steps;
    var ids = fields.map(function (f) {
      return f.id;
    });
    return [{ id: 'all', title: DETAILS, fields: ids }];
  }

  /**
   * Puts the questions no step asks into the last step, made when there is
   * none.
   *
   * @param {!Array<!Object>} steps The steps.
   * @param {!Array<!Object>} left The questions no step asks.
   */
  function addLeftOver(steps, left) {
    if (!left.length) return;
    if (!steps.length) steps.push({ id: 'more', title: DETAILS, fields: [] });
    var last = steps[steps.length - 1];
    last.fields = last.fields.concat(left);
  }

  /** Sets the steps of the form, each with the questions it asks. */
  function buildSteps() {
    if (P.keyMode()) {
      buildKeySteps();
      return;
    }
    var fields = P.activeFields();
    var byId = {};
    fields.forEach(function (f) {
      byId[f.id] = f;
    });
    var used = {};
    var steps = stepDefs(fields)
      .map(function (s) {
        var asked = s.fields.filter(function (id) {
          return byId[id];
        });
        asked.forEach(function (id) {
          used[id] = true;
        });
        return {
          id: s.id,
          title: s.title,
          fields: asked.map((id) => byId[id])
        };
      })
      .filter(function (s) {
        return s.fields.length;
      });
    addLeftOver(
      steps,
      fields.filter(function (f) {
        return !used[f.id];
      })
    );
    steps.push({ id: '_review', review: true, fields: [] });
    S.steps = steps;
  }

  /**
   * Gives the title of a step.
   *
   * @param {!Object} s The step.
   * @return {string} The title in the page language.
   */
  function stepTitle(s) {
    if (s.review) return t('reviewStep');
    return s.team ? t('teamStep') : L(s.title);
  }

  /**
   * Finds the step an answer is on.
   *
   * @param {string} path The path of the answer.
   * @return {number} The index of the step, or 0.
   */
  function stepOfPath(path) {
    var id = path.split('.')[0];
    var found = S.steps.findIndex(function (step) {
      return step.fields.some(function (f) {
        return f.id === id;
      });
    });
    return Math.max(found, 0);
  }

  P.buildSteps = buildSteps;
  P.stepTitle = stepTitle;
  P.stepOfPath = stepOfPath;
})(window.App);
