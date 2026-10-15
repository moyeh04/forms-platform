/**
 * The dialog of a request to move a member: the leader who holds the member
 * approves or rejects it, and a leader who moves names who leads next.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /**
   * Finds the email question of the form, when it is on.
   *
   * @return {?Object} The field, or null.
   */
  function emailQuestion() {
    var f = Rules.fieldByRole(S.form, 'email');
    return f && f.enabled !== false ? f : null;
  }

  /**
   * Gives the sentence of an error code.
   *
   * @param {string} code The code.
   * @return {string} The sentence.
   */
  function errorText(code) {
    return App.i18n.err({ error: code });
  }

  /**
   * Makes the question of who leads the team next, for a leader who is
   * asked for.
   *
   * @param {!Array<!Object>} heirs The members who can lead.
   * @return {?Object} The question, as App.handover gives it, or null when
   *     nobody can lead.
   */
  function handoverQuestion(heirs) {
    if (!heirs.length) return null;
    return App.handover({
      heirs: heirs,
      email: emailQuestion(),
      words: {
        who: t('handoverWho'),
        email: t('handoverEmail'),
        choose: t('handoverPick'),
        error: errorText
      }
    });
  }

  /**
   * Makes a button of the dialog.
   *
   * @param {string} cls Its look, such as 'btn-primary'.
   * @param {string} name Its name.
   * @param {string} text Its text.
   * @param {function()} act What it does.
   * @return {!Element} The button.
   */
  function dialogButton(cls, name, text, act) {
    return h(
      'button',
      { type: 'button', class: 'btn ' + cls, name: name, onclick: act },
      text
    );
  }

  /**
   * Writes the size the team will have after the move, and whether that is
   * under the smallest size.
   *
   * @param {!Object} r The request.
   * @return {string} The sentence.
   */
  function sizeAfter(r) {
    var after = r.leader
      ? t('handoverSizeAfter', { n: r.sizeAfter })
      : t('transferSizeAfter', { n: r.sizeAfter });
    if (r.sizeAfter >= r.min) return after;
    return after + ' ' + t('transferUnderMin', { min: r.min });
  }

  /**
   * Writes what the request asks, and for a leader whether somebody can
   * lead next.
   *
   * @param {!Object} r The request.
   * @param {?Object} next The question of the next leader, or null.
   * @return {string} The text.
   */
  function askText(r, next) {
    if (!r.leader) return P.askedText(r);
    return P.askedText(r) + ' ' + t(next ? 'handoverChoose' : 'handoverAlone');
  }

  /**
   * Makes the approve button. A leader who is asked for can only approve
   * while there is somebody to name.
   *
   * @param {!Object} r The request.
   * @param {?Object} next The question of the next leader, or null.
   * @param {function(?Object)} done Closes the dialog with the answer.
   * @return {?Element} The button, or null.
   */
  function approveButton(r, next, done) {
    if (r.leader && !next) return null;
    return dialogButton(
      'btn-primary',
      'transfer-approve',
      t(next ? 'handoverApprove' : 'transferApprove'),
      function () {
        if (next?.problem()) return;
        done({ approve: true, handover: next ? next.value() : undefined });
      }
    );
  }

  /**
   * Shows the request and gives the answer once.
   *
   * @param {!Object} r The request.
   * @param {function(?Object)} resolve Gets the answer.
   */
  function openTransfer(r, resolve) {
    var overlay;

    /**
     * Closes the dialog with an answer.
     *
     * @param {?Object} v The answer, or null for later.
     */
    function done(v) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(v);
    }

    var next = r.leader ? handoverQuestion(r.heirs || []) : null;
    var title = t(r.leader ? 'transferAskedYouTitle' : 'transferAskedTitle');
    var later = dialogButton(
      'btn-quiet',
      'transfer-later',
      t('transferLater'),
      function () {
        done(null);
      }
    );
    var reject = dialogButton(
      'btn-quiet',
      'transfer-reject',
      t('transferReject'),
      function () {
        done({ approve: false });
      }
    );
    var approve = approveButton(r, next, done);
    overlay = h(
      'div',
      {
        class: 'overlay',
        onclick: function (e) {
          if (e.target === overlay) done(null);
        }
      },
      h(
        'div',
        {
          class: 'dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': title
        },
        h('h2', { class: 'dialog-title' }, title),
        h('p', null, askText(r, next)),
        P.leaderContact(r),
        next ? next.node : null,
        approve ? h('p', { class: 'help' }, sizeAfter(r)) : null,
        h(
          'div',
          { class: 'dialog-actions transfer-actions' },
          later,
          reject,
          approve
        )
      )
    );
    document.body.appendChild(overlay);
    later.focus();
  }

  /**
   * Asks a request as a question with three answers. A leader who is asked
   * for names who leads the team next.
   *
   * @param {!Object} r The request.
   * @return {!Promise<?Object>} `{approve, handover}`, or null for later.
   */
  function transferDialog(r) {
    return new Promise(function (resolve) {
      openTransfer(r, resolve);
    });
  }

  P.transferDialog = transferDialog;
})(window.App);
