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

  function flatten(errors) {
    var out = {};
    Object.keys(errors || {}).forEach(function (id) {
      var e = errors[id];
      if (e.nested)
        Object.keys(e.nested).forEach(function (k) {
          out[id + '.' + k] = e.nested[k];
        });
      else out[id] = { error: e.error, params: e.params };
    });
    return out;
  }

  function validateAll() {
    if (P.keyMode() || P.slotOnly()) {
      // Only the slot is answered here; everything else comes from the registration, or is kept as saved.
      var sf = P.slotField(),
        r = Rules.validateField(sf, S.data[sf.id], { form: S.form }),
        out = {
          ok: r.ok,
          errors: {},
          data: P.keyMode() ? {} : Object.assign({}, S.data)
        };
      if (r.ok) out.data[sf.id] = r.value;
      else out.errors[sf.id] = { error: r.error };
      return out;
    }
    var v = Rules.validateSubmission(S.form, S.data);
    return { ok: v.ok, errors: flatten(v.errors), data: v.data };
  }

  function go(i) {
    S.stepIndex = Math.max(0, Math.min(i, S.steps.length - 1));
    S.banner = null;
    P.saveDraft();
    P.render();
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      /* not available */
    }
    var title = document.getElementById('step-title');
    if (title && title.focus) title.focus({ preventScroll: true });
  }

  function focusFirstError() {
    var node = root.querySelector('.field.has-error');
    if (!node) return;
    try {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (e) {
      /* not available */
    }
    var input = node.querySelector('input, select, textarea, button');
    if (input && input.focus) input.focus({ preventScroll: true });
  }

  function next() {
    var step = S.steps[S.stepIndex];
    if (step.review) return P.submit();
    if (step.team)
      return S.team
        ? S.teamBooked
          ? undefined
          : go(S.stepIndex + 1)
        : P.findTeam();
    var v = validateAll();
    var ids = step.fields.map(function (f) {
      return f.id;
    });
    var stepErrors = {};
    Object.keys(v.errors).forEach(function (k) {
      if (ids.indexOf(k.split('.')[0]) !== -1) stepErrors[k] = v.errors[k];
    });
    Object.keys(S.errors).forEach(function (k) {
      if (ids.indexOf(k.split('.')[0]) !== -1) delete S.errors[k];
    });
    if (Object.keys(stepErrors).length) {
      Object.assign(S.errors, stepErrors);
      S.banner = { kind: 'err', text: t('fixErrors') };
      P.render();
      focusFirstError();
      return;
    }
    go(P.hub() ? S.steps.length - 1 : S.stepIndex + 1);
  }

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
