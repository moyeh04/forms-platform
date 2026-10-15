/**
 * The students another team asked for, each with Reject and Approve and
 * move. Moving a leader first asks who leads the team next.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var Rules = window.Rules;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Says what is wrong with the email of the new leader.
   *
   * @param {string} code required, or the code of a wrong address.
   * @return {string} The reason.
   */
  function emailError(code) {
    return code === 'required'
      ? 'Write the email of the new leader.'
      : 'Enter a valid email address.';
  }

  /**
   * Asks who leads the team next, with the question the leader gets on
   * the form.
   *
   * @param {!Object} form The form.
   * @param {!Object} t The transfer.
   * @return {!Object} The handover control.
   */
  function askNext(form, t) {
    var emailField = Rules.fieldByRole(form, 'email');
    return App.handover({
      heirs: t.heirs,
      email: emailField && emailField.enabled !== false ? emailField : null,
      words: {
        who: 'New leader of ' + t.from,
        email: 'Email of the new leader',
        choose: 'Choose the new leader.',
        error: emailError
      }
    });
  }

  /**
   * Says what an answer did.
   *
   * @param {!Object} t The transfer.
   * @param {boolean} approve True when the student moved.
   * @param {?Object} heir The new leader, or null.
   * @param {!Object} out What the server answered.
   * @return {string} The message.
   */
  function doneText(t, approve, heir, out) {
    var who = t.name || t.code;
    if (!approve) return 'Rejected. ' + who + ' stays in ' + t.from + '.';
    return (
      who +
      ' moved to ' +
      t.to +
      '.' +
      (heir
        ? ' ' + (heir.name || heir.code) + ' leads ' + t.from + ' now.'
        : '') +
      (out.underMin
        ? ' ' + t.from + ' is now under the minimum team size.'
        : '')
    );
  }

  /**
   * Confirms who leads the team the leader leaves.
   *
   * @param {!Object} t The transfer.
   * @param {!Object} next The handover control.
   * @return {!Promise<boolean>} True to go on.
   */
  function confirmHandover(t, next) {
    return ui.confirm({
      title: 'Who leads ' + t.from + ' next?',
      body:
        (t.name || t.code) +
        ' leads ' +
        t.from +
        '. Moving them to ' +
        t.to +
        ' hands that team to one of its members.',
      content: next.node,
      ready: function () {
        return !next.problem();
      },
      confirmText: 'Hand over and move'
    });
  }

  /**
   * Answers a transfer, after asking who leads next when a leader moves.
   *
   * @param {!Object} p The page: form and reload.
   * @param {!Object} t The transfer.
   * @param {boolean} approve True to move the student.
   * @param {!Event} e The click.
   * @return {!Promise} Settles once it is answered or not.
   */
  async function decide(p, t, approve, e) {
    var button = e.currentTarget;
    var next = approve && t.leader ? askNext(p.form, t) : null;
    if (next && !(await confirmHandover(t, next))) return;
    A.busy(button, async function () {
      var out = await A.call('admin.transfer.decide', {
        slug: p.form.slug,
        transfer: t.id,
        approve: approve,
        handover: next ? next.value() : undefined
      });
      var heir = next
        ? t.heirs.filter(function (m) {
            return m.code === next.value().leader;
          })[0]
        : null;
      ui.toast(doneText(t, approve, heir, out), 'ok');
      p.reload();
    });
  }

  /**
   * Draws a quiet part of the text of a transfer.
   *
   * @param {string} text The text.
   * @param {string=} name The name the tests find it by.
   * @return {!Element} The part.
   */
  function muted(text, name) {
    return h('span', { class: 'muted-note', name: name }, text);
  }

  /**
   * Says who is asked for, from which team and to which.
   *
   * @param {!Object} t The transfer.
   * @param {boolean} alone True when a leader has nobody to hand over to.
   * @return {!Element} The text.
   */
  function requestText(t, alone) {
    return h(
      'span',
      { class: 'request-text' },
      h('strong', { dir: 'auto' }, t.name || t.code),
      ' ',
      h('span', { class: 'mono' }, t.code),
      muted(' from '),
      h('strong', null, t.from),
      t.leader
        ? muted(
            alone ? ', which they lead alone,' : ', which they lead,',
            'transfer-leads'
          )
        : null,
      muted(' to '),
      h('strong', null, t.to),
      alone
        ? muted('. Nobody is left to lead ' + t.from + ', so they cannot move.')
        : null
    );
  }

  /**
   * Draws a transfer with its buttons. A leader with nobody to hand the
   * team to cannot move, so only Reject is left.
   *
   * @param {!Object} p The page: form and reload.
   * @param {!Object} t The transfer.
   * @return {!Element} The row.
   */
  function transferRow(p, t) {
    var alone = t.leader && !t.heirs.length;
    return h(
      'div',
      { class: 'request-row', dataset: { transfer: t.id } },
      requestText(t, alone),
      h(
        'span',
        { class: 'actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet sm',
            name: 'transfer-reject',
            onclick: decide.bind(null, p, t, false)
          },
          'Reject'
        ),
        alone
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'btn btn-primary sm',
                name: 'transfer-approve',
                onclick: decide.bind(null, p, t, true)
              },
              'Approve and move'
            )
      )
    );
  }

  /**
   * Draws the transfers that wait for an answer, with their heading.
   *
   * @param {!Object} p The page: form, transfers and reload.
   * @return {!Array<?Element>} The heading, the help and the rows.
   */
  R.transferRows = function (p) {
    var n = p.transfers.length;
    if (!n) return [];
    return [
      h(
        'h3',
        null,
        n === 1
          ? 'One student asked for by another team'
          : n + ' students asked for by another team'
      ),
      h(
        'p',
        { class: 'help' },
        'The leader of the team that holds the student can answer with the' +
          ' edit key. You can answer here as well; the first answer counts.'
      )
    ].concat(p.transfers.map(transferRow.bind(null, p)));
  };
})(window.App);
