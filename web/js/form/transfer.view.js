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
   * The request as a question with three answers. Resolves to { approve, handover }, or to null
   * for "later". A leader who is asked for names who leads the team next, and can only approve
   * while there is somebody to name.
   */
  function transferDialog(r) {
    return new Promise(function (resolve) {
      var done = function (v) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(v);
      };
      var btn = function (cls, name, text, act) {
        return h(
          'button',
          { type: 'button', class: 'btn ' + cls, name: name, onclick: act },
          text
        );
      };
      var heirs = r.leader ? r.heirs || [] : null;
      var next =
        heirs && heirs.length
          ? App.handover({
              heirs: heirs,
              email: emailQuestion(),
              words: {
                who: t('handoverWho'),
                email: t('handoverEmail'),
                choose: t('handoverPick'),
                error: function (code) {
                  return App.i18n.err({ error: code });
                }
              }
            })
          : null;
      var title = t(r.leader ? 'transferAskedYouTitle' : 'transferAskedTitle');
      var after = r.leader
        ? t('handoverSizeAfter', { n: r.sizeAfter })
        : t('transferSizeAfter', { n: r.sizeAfter });
      var later = btn(
        'btn-quiet',
        'transfer-later',
        t('transferLater'),
        function () {
          done(null);
        }
      );
      var approve =
        heirs && !next
          ? null
          : btn(
              'btn-primary',
              'transfer-approve',
              t(next ? 'handoverApprove' : 'transferApprove'),
              function () {
                if (next && next.problem()) return;
                done({
                  approve: true,
                  handover: next ? next.value() : undefined
                });
              }
            );
      var overlay = h(
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
          h(
            'p',
            null,
            P.askedText(r) +
              (heirs ? ' ' + t(next ? 'handoverChoose' : 'handoverAlone') : '')
          ),
          P.leaderContact(r),
          next ? next.node : null,
          approve
            ? h(
                'p',
                { class: 'help' },
                after +
                  (r.sizeAfter < r.min
                    ? ' ' + t('transferUnderMin', { min: r.min })
                    : '')
              )
            : null,
          h(
            'div',
            { class: 'dialog-actions transfer-actions' },
            later,
            btn(
              'btn-quiet',
              'transfer-reject',
              t('transferReject'),
              function () {
                done({ approve: false });
              }
            ),
            approve
          )
        )
      );
      document.body.appendChild(overlay);
      later.focus();
    });
  }

  function emailQuestion() {
    var f = Rules.fieldByRole(S.form, 'email');
    return f && f.enabled !== false ? f : null;
  }

  P.transferDialog = transferDialog;
})(window.App);
