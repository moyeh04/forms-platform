/**
 * Drafts: the answers are kept in the tab's session storage, so a reload does
 * not wipe a half-filled form.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var S = P.S;

  function draftKey() {
    return 'fp_draft_' + S.slug;
  }

  function sess() {
    try {
      return window.sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function saveDraft() {
    var s = sess();
    if (s && S.mode === 'new')
      s.setItem(
        draftKey(),
        JSON.stringify({ data: S.data, step: S.stepIndex })
      );
  }

  function restoreDraft() {
    var s = sess();
    var raw = s && s.getItem(draftKey());
    if (!raw) return;
    try {
      var d = JSON.parse(raw);
      S.data = d.data || {};
      // The team is asked for again after a reload: the key is never kept in the browser.
      S.stepIndex = P.keyMode() ? 0 : Math.min(d.step || 0, S.steps.length - 1);
    } catch (e) {
      /* ignore a broken draft */
    }
  }

  function clearDraft() {
    var s = sess();
    if (s) s.removeItem(draftKey());
  }

  P.restoreDraft = restoreDraft;
  P.saveDraft = saveDraft;
  P.clearDraft = clearDraft;
})(window.App);
