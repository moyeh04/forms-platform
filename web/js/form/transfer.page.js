/**
 * The requests to move a member when a registration opens: asking about each
 * waiting one, cancelling one, the notes above the registration, and the page
 * of a leader who moved.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /** The page a leader lands on after moving: the team they led is no longer theirs to edit. */
  function movedView() {
    return P.sheet(
      P.head(),
      h(
        'h2',
        { class: 'state-title' },
        t('movedTitle', { team: S.moved.team })
      ),
      h('p', { name: 'moved-note' }, t('movedBody', S.moved)),
      h(
        'div',
        { class: 'nav' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary',
            name: 'close-edit',
            onclick: function () {
              P.resetForNew();
            }
          },
          t('closeEdit')
        )
      )
    );
  }

  async function answerTransfer(r) {
    // An approval replaces the answers on this page with the saved ones, so edits are saved first.
    if (P.changed()) {
      S.banner = { kind: 'err', text: t('transferSaveFirst') };
      return P.render();
    }
    var answer = await P.transferDialog(r);
    if (!answer) return;
    try {
      var res = await App.api.call({
        action: 'transfer.decide',
        slug: S.slug,
        key: S.key,
        id: r.id,
        approve: answer.approve,
        handover: answer.handover
      });
      if (answer.handover) {
        var heir = r.heirs.filter(function (m) {
          return m.code === answer.handover.leader;
        })[0];
        S.moved = {
          team: r.team,
          ref: S.keyInfo.ref,
          who: P.who(heir.name, heir.code),
          key: S.key
        };
        S.view = 'moved';
        return P.render();
      }
      S.data = res.submission.data || {};
      S.original = JSON.stringify(S.data);
      S.transfers = res.transfers;
      S.banner = {
        kind: 'info',
        text: t(
          answer.approve
            ? 'transferApproved'
            : r.leader
              ? 'transferStayed'
              : 'transferRejected',
          { who: P.who(r.name, r.code), team: r.team }
        )
      };
      P.buildSteps();
      S.stepIndex = S.steps.length - 1;
    } catch (e) {
      S.banner = {
        kind: 'err',
        text: App.i18n.err({ error: e.code }) || e.message
      };
      try {
        S.transfers = (
          await App.api.call({ action: 'lookup', slug: S.slug, key: S.key })
        ).transfers;
      } catch (x) {
        /* keep what is shown */
      }
    }
    P.render();
  }

  /** Asks about each waiting request, one after the other, when the registration opens. */
  async function askTransfers() {
    var list = (S.transfers.incoming || []).slice();
    // A leader who moved has left the team, so the rest of its requests are no longer theirs to answer.
    for (var i = 0; i < list.length && S.view !== 'moved'; i++)
      await answerTransfer(list[i]);
  }

  async function cancelTransfer(r) {
    try {
      S.transfers = (
        await App.api.call({
          action: 'transfer.cancel',
          slug: S.slug,
          key: S.key,
          id: r.id
        })
      ).transfers;
    } catch (e) {
      S.banner = {
        kind: 'err',
        text: App.i18n.err({ error: e.code }) || e.message
      };
    }
    P.render();
  }

  /** One line for each request that waits or was answered, above the registration. */
  function transferNotes() {
    var tr = S.transfers || {};
    var lines = (tr.incoming || [])
      .map(function (r) {
        return h(
          'div',
          {
            class: 'banner info transfer-note',
            role: 'status',
            dataset: { transfer: 'incoming' }
          },
          P.askedText(r),
          ' ',
          h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: 'transfer-answer',
              onclick: function () {
                answerTransfer(r);
              }
            },
            t('transferAnswer')
          ),
          P.leaderContact(r)
        );
      })
      .concat(
        (tr.outgoing || []).map(function (r) {
          var key = {
            pending: 'transferWaiting',
            approved: 'transferJoined',
            rejected: 'transferKept',
            closed: 'transferElsewhere'
          }[r.status];
          if (!key) return null;
          return h(
            'div',
            {
              class: 'banner info transfer-note',
              role: 'status',
              dataset: { transfer: r.status }
            },
            t(key, { team: r.team, who: P.who(r.name, r.code) }),
            ' ',
            r.status === 'pending'
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'link-btn',
                    name: 'transfer-cancel',
                    onclick: function () {
                      cancelTransfer(r);
                    }
                  },
                  t('transferCancel')
                )
              : null,
            P.leaderContact(r)
          );
        })
      )
      .filter(Boolean);
    return lines.length ? h('div', { class: 'transfer-notes' }, lines) : null;
  }

  P.movedView = movedView;
  P.transferNotes = transferNotes;
  P.askTransfers = askTransfers;
})(window.App);
