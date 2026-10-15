/**
 * Moving between steps: checking the answers of a step, showing the errors and
 * jumping to the first one.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var t = P.t;
  var root = P.root;
  var S = P.S;

  /**
   * Turns the errors of a submission into one error per answer path, the
   * errors of each member under `members.<i>.<field>`.
   *
   * @param {?Object} errors The errors, by question id.
   * @return {!Object} The errors, by path.
   */
  function flatten(errors) {
    var out = {};
    Object.keys(errors || {}).forEach(function (id) {
      var e = errors[id];
      if (!e.nested) {
        out[id] = { error: e.error, params: e.params };
        return;
      }
      Object.keys(e.nested).forEach(function (k) {
        out[id + '.' + k] = e.nested[k];
      });
    });
    return out;
  }

  /**
   * Checks the slot alone. Everything else comes from the registration of
   * the key, or is kept as saved.
   *
   * @return {{ok: boolean, errors: !Object, data: !Object}} The result.
   */
  function validateSlot() {
    var sf = P.slotField();
    var r = Rules.validateField(sf, S.data[sf.id], { form: S.form });
    var out = {
      ok: r.ok,
      errors: {},
      data: P.keyMode() ? {} : Object.assign({}, S.data)
    };
    if (r.ok) out.data[sf.id] = r.value;
    else out.errors[sf.id] = { error: r.error };
    return out;
  }

  /**
   * Checks every answer that will be sent.
   *
   * @return {{ok: boolean, errors: !Object, data: !Object}} The result,
   *     with the errors by path and the cleaned answers.
   */
  function validateAll() {
    if (P.keyMode() || P.slotOnly()) return validateSlot();
    var v = Rules.validateSubmission(S.form, S.data);
    return { ok: v.ok, errors: flatten(v.errors), data: v.data };
  }

  /**
   * Moves the focus to the title of the step, without scrolling.
   */
  function focusTitle() {
    var title = document.getElementById('step-title');
    if (title?.focus) title.focus({ preventScroll: true });
  }

  /**
   * Shows a step, at the top of the page.
   *
   * @param {number} i The step.
   */
  function go(i) {
    S.stepIndex = Math.max(0, Math.min(i, S.steps.length - 1));
    S.banner = null;
    P.saveDraft();
    P.render();
    try {
      window.scrollTo(0, 0);
    } catch {
      /* not available */
    }
    focusTitle();
  }

  /** Scrolls to the first question with an error and focuses it. */
  function focusFirstError() {
    var node = root.querySelector('.field.has-error');
    if (!node) return;
    try {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* not available */
    }
    var input = node.querySelector('input, select, textarea, button');
    if (input?.focus) input.focus({ preventScroll: true });
  }

  /**
   * Keeps the errors of one step: the old ones of its questions go, the new
   * ones come in.
   *
   * @param {!Object} step The step.
   * @param {!Object} errors Every error, by path.
   * @return {boolean} True when the step has errors.
   */
  function takeStepErrors(step, errors) {
    var ids = step.fields.map(function (f) {
      return f.id;
    });
    /**
     * Says whether an answer is on this step.
     *
     * @param {string} k The path of the answer.
     * @return {boolean} True when its question is on the step.
     */
    function onStep(k) {
      return ids.indexOf(k.split('.')[0]) !== -1;
    }
    Object.keys(S.errors)
      .filter(onStep)
      .forEach(function (k) {
        delete S.errors[k];
      });
    var mine = Object.keys(errors).filter(onStep);
    mine.forEach(function (k) {
      S.errors[k] = errors[k];
    });
    return mine.length > 0;
  }

  /**
   * Goes on from the team step of a key booking: finds the team, or moves
   * on once it is found, unless it has a booking already.
   */
  function nextFromTeam() {
    if (!S.team) P.findTeam();
    else if (!S.teamBooked) go(S.stepIndex + 1);
  }

  /**
   * Goes to the next step when the answers of this one are right, or sends
   * the registration from the review. With a key the next step is the
   * summary.
   */
  function next() {
    var step = S.steps[S.stepIndex];
    if (step.review) {
      P.submit();
      return;
    }
    if (step.team) {
      nextFromTeam();
      return;
    }
    if (takeStepErrors(step, validateAll().errors)) {
      S.banner = { kind: 'err', text: t('fixErrors') };
      P.render();
      focusFirstError();
      return;
    }
    go(P.hub() ? S.steps.length - 1 : S.stepIndex + 1);
  }

  /**
   * Shows errors the server found, on the step of the first one.
   *
   * @param {!Object} errs The errors, by path.
   */
  function showErrorsAndJump(errs) {
    S.errors = errs;
    var first = Object.keys(errs)[0];
    S.stepIndex = first ? P.stepOfPath(first) : S.stepIndex;
    S.banner = { kind: 'err', text: t('fixErrors') };
    P.render();
    focusFirstError();
  }

  P.go = go;
  P.next = next;
  P.focusFirstError = focusFirstError;
  P.validateAll = validateAll;
  P.showErrorsAndJump = showErrorsAndJump;
})(window.App);
