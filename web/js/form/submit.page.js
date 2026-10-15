/**
 * Sending the registration, and what the page does with each error the server
 * gives back.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var S = P.S;

  /**
   * Saves the changes of a registration opened with its key.
   *
   * @param {!Object} v The checked answers.
   * @return {!Promise<!Object>} The answer of the server.
   */
  async function sendUpdate(v) {
    var res = await App.api.call({
      action: 'update',
      slug: S.slug,
      key: S.key,
      data: v.data,
      transfer: S.transfer || undefined
    });
    S.result = { ref: res.ref, edited: true };
    return res;
  }

  /**
   * Sends a new registration, with the team's key for a key booking.
   *
   * @param {!Object} v The checked answers.
   * @return {!Promise<!Object>} The answer of the server.
   */
  async function sendNew(v) {
    var request = {
      action: 'submit',
      slug: S.slug,
      data: v.data,
      lang: App.i18n.lang,
      transfer: S.transfer || undefined
    };
    if (P.keyMode()) request.sourceKey = S.sourceKey;
    var res = await App.api.call(request);
    S.result = {
      ref: res.ref,
      key: res.key,
      keyExpires: res.keyExpires,
      emailed: !!res.emailed
    };
    return res;
  }

  /**
   * Shows the ticket of a sent registration. A member that was asked for
   * from another team is not in the saved answers yet.
   *
   * @param {!Object} res The answer of the server.
   * @param {!Object} v The checked answers.
   */
  function showTicket(res, v) {
    S.data = res.data || v.data;
    S.result.transfers = res.transfers || [];
    S.transfer = null;
    P.clearDraft();
    S.busy = false;
    S.view = 'ticket';
    P.render();
    try {
      window.scrollTo(0, 0);
    } catch {
      /* not available */
    }
  }

  /**
   * Checks the answers and sends the registration, or shows what is wrong.
   * A key booking without its team goes back to the team step.
   *
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function submit() {
    if (P.keyMode() && !S.team) return P.go(0);
    var v = P.validateAll();
    if (!v.ok) return P.showErrorsAndJump(v.errors);
    S.busy = true;
    S.banner = null;
    P.render();
    var res;
    try {
      res = await (S.mode === 'edit' ? sendUpdate(v) : sendNew(v));
    } catch (e) {
      S.busy = false;
      return P.handleSubmitError(e);
    }
    showTicket(res, v);
  }

  P.submit = submit;
})(window.App);
