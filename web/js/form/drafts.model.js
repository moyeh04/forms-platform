/**
 * Drafts: the answers are kept in the tab's session storage, so a reload does
 * not wipe a half-filled form.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var S = P.S;

  /**
   * Gives the session storage key of this form's draft.
   *
   * @return {string} The key.
   */
  function draftKey() {
    return 'fp_draft_' + S.slug;
  }

  /**
   * Finds the session storage, which a locked-down browser may refuse.
   *
   * @return {?Storage} The storage, or null.
   */
  function sess() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  /** Keeps the answers and the step of a new registration. */
  function saveDraft() {
    var s = sess();
    if (!s || S.mode !== 'new') return;
    s.setItem(draftKey(), JSON.stringify({ data: S.data, step: S.stepIndex }));
  }

  /**
   * Brings back a kept draft. The team of a key booking is asked for again
   * after a reload: the key is never kept in the browser. A broken draft
   * is ignored.
   */
  function restoreDraft() {
    var s = sess();
    var raw = s?.getItem(draftKey());
    if (!raw) return;
    var last = S.steps.length - 1;
    var d;
    try {
      d = JSON.parse(raw);
      S.data = d.data || {};
      S.stepIndex = P.keyMode() ? 0 : Math.min(d.step || 0, last);
    } catch {
      /* ignore a broken draft */
    }
  }

  /** Forgets the draft. */
  function clearDraft() {
    var s = sess();
    if (s) s.removeItem(draftKey());
  }

  P.restoreDraft = restoreDraft;
  P.saveDraft = saveDraft;
  P.clearDraft = clearDraft;
})(window.App);
