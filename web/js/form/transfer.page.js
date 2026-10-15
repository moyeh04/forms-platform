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

  /** The text of a request this team sent, by its status. */
  var OUTGOING_TEXT = {
    pending: 'transferWaiting',
    approved: 'transferJoined',
    rejected: 'transferKept',
    closed: 'transferElsewhere'
  };

  /**
   * Draws the page a leader lands on after moving: the team they led is no
   * longer theirs to edit.
   *
   * @return {!Element} The sheet.
   */
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

  /**
   * Shows the page of a leader who moved, naming who leads next.
   *
   * @param {!Object} r The request.
   * @param {!Object} handover The next leader, as `{leader, email}`.
   */
  function showMoved(r, handover) {
    var heir = r.heirs.filter(function (m) {
      return m.code === handover.leader;
    })[0];
    S.moved = {
      team: r.team,
      ref: S.keyInfo.ref,
      who: P.who(heir.name, heir.code),
      key: S.key
    };
    S.view = 'moved';
  }

  /**
   * Writes what happened to a request that was answered.
   *
   * @param {!Object} r The request.
   * @param {boolean} approve True when it was approved.
   * @return {string} The sentence.
   */
  function decidedText(r, approve) {
    var key = 'transferRejected';
    if (approve) key = 'transferApproved';
    else if (r.leader) key = 'transferStayed';
    return t(key, { who: P.who(r.name, r.code), team: r.team });
  }

  /**
   * Takes in the registration after an answer, on its summary.
   *
   * @param {!Object} res The answer of transfer.decide.
   * @param {!Object} r The request.
   * @param {boolean} approve True when it was approved.
   */
  function takeDecision(res, r, approve) {
    S.data = res.submission.data || {};
    S.original = JSON.stringify(S.data);
    S.transfers = res.transfers;
    S.banner = { kind: 'info', text: decidedText(r, approve) };
    P.buildSteps();
    S.stepIndex = S.steps.length - 1;
  }

  /**
   * Reads the requests again after an error. On another error the page
   * keeps what it shows.
   *
   * @return {!Promise<void>} Settles when done.
   */
  async function reloadTransfers() {
    var res;
    try {
      res = await App.api.call({ action: 'lookup', slug: S.slug, key: S.key });
    } catch {
      return;
    }
    S.transfers = res.transfers;
  }

  /**
   * Sends an answer to a request and shows what follows.
   *
   * @param {!Object} r The request.
   * @param {!Object} answer The answer, as `{approve, handover}`.
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function decide(r, answer) {
    var res;
    try {
      res = await App.api.call({
        action: 'transfer.decide',
        slug: S.slug,
        key: S.key,
        id: r.id,
        approve: answer.approve,
        handover: answer.handover
      });
    } catch (e) {
      S.banner = {
        kind: 'err',
        text: App.i18n.err({ error: e.code }) || e.message
      };
      await reloadTransfers();
      return P.render();
    }
    if (answer.handover) showMoved(r, answer.handover);
    else takeDecision(res, r, answer.approve);
    P.render();
  }

  /**
   * Asks about a request and sends the answer. An approval replaces the
   * answers on this page with the saved ones, so edits are saved first.
   *
   * @param {!Object} r The request.
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function answerTransfer(r) {
    if (P.changed()) {
      S.banner = { kind: 'err', text: t('transferSaveFirst') };
      return P.render();
    }
    var answer = await P.transferDialog(r);
    if (answer) await decide(r, answer);
  }

  /**
   * Asks about each waiting request, one after the other, when the
   * registration opens. A leader who moved has left the team, so the rest
   * of its requests are no longer theirs to answer.
   *
   * @return {!Promise<void>} Settles when every request was asked.
   */
  async function askTransfers() {
    var list = (S.transfers.incoming || []).slice();
    for (const r of list) {
      if (S.view === 'moved') break;
      await answerTransfer(r);
    }
  }

  /**
   * Withdraws a request this team sent.
   *
   * @param {!Object} r The request.
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function cancelTransfer(r) {
    var res;
    try {
      res = await App.api.call({
        action: 'transfer.cancel',
        slug: S.slug,
        key: S.key,
        id: r.id
      });
      S.transfers = res.transfers;
    } catch (e) {
      S.banner = {
        kind: 'err',
        text: App.i18n.err({ error: e.code }) || e.message
      };
    }
    P.render();
  }

  /**
   * Makes a link button of a note.
   *
   * @param {string} name Its name.
   * @param {string} text Its text.
   * @param {function()} act What it does.
   * @return {!Element} The button.
   */
  function noteButton(name, text, act) {
    return h(
      'button',
      { type: 'button', class: 'link-btn', name: name, onclick: act },
      text
    );
  }

  /**
   * Draws the note of a request this team was sent, with its Answer
   * button.
   *
   * @param {!Object} r The request.
   * @return {!Element} The note.
   */
  function incomingNote(r) {
    return h(
      'div',
      {
        class: 'banner info transfer-note',
        role: 'status',
        dataset: { transfer: 'incoming' }
      },
      P.askedText(r),
      ' ',
      noteButton('transfer-answer', t('transferAnswer'), function () {
        answerTransfer(r);
      }),
      P.leaderContact(r)
    );
  }

  /**
   * Draws the note of a request this team sent, with a Cancel button while
   * it waits.
   *
   * @param {!Object} r The request.
   * @return {?Element} The note, or null for an unknown status.
   */
  function outgoingNote(r) {
    var key = OUTGOING_TEXT[r.status];
    if (!key) return null;
    var cancel =
      r.status === 'pending'
        ? noteButton('transfer-cancel', t('transferCancel'), function () {
            cancelTransfer(r);
          })
        : null;
    return h(
      'div',
      {
        class: 'banner info transfer-note',
        role: 'status',
        dataset: { transfer: r.status }
      },
      t(key, { team: r.team, who: P.who(r.name, r.code) }),
      ' ',
      cancel,
      P.leaderContact(r)
    );
  }

  /**
   * Draws one line for each request that waits or was answered, above the
   * registration.
   *
   * @return {?Element} The notes, or null when there are none.
   */
  function transferNotes() {
    var tr = S.transfers || {};
    var lines = (tr.incoming || [])
      .map(incomingNote)
      .concat((tr.outgoing || []).map(outgoingNote))
      .filter(Boolean);
    return lines.length ? h('div', { class: 'transfer-notes' }, lines) : null;
  }

  P.movedView = movedView;
  P.transferNotes = transferNotes;
  P.askTransfers = askTransfers;
})(window.App);
