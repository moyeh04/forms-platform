/**
 * The first step of a key booking: the registration key, then the team it opens
 * for the student to confirm.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /**
   * Draws the note that the team has a booking already. The key that found
   * the team usually opens its booking too; when it does not, the key
   * screen says so.
   *
   * @return {?Element} The note, or null when the team has none.
   */
  function bookedNote() {
    if (!S.teamBooked) return null;
    var text = S.teamSlot
      ? t('teamBookedAt', { when: P.displayValue(P.slotField(), S.teamSlot) })
      : t('teamBooked');
    return h(
      'div',
      { class: 'banner info', role: 'status', name: 'team-booked' },
      text
    );
  }

  /**
   * Draws the team a key found, for the student to confirm.
   *
   * @return {!Array<?Element>} The parts of the step.
   */
  function foundTeam() {
    return [
      h('p', { class: 'step-help' }, t('teamIs') + ' (' + S.team.ref + ')'),
      P.teamSummary(),
      bookedNote(),
      h(
        'p',
        { class: 'foot' },
        h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            name: 'other-key',
            onclick: function () {
              forgetTeam();
              P.render();
            }
          },
          t('otherKey')
        )
      )
    ];
  }

  /**
   * Draws the first step of a key booking: the key, then the team it opens
   * for the student to confirm.
   *
   * @return {!Array<?Element>} The parts of the step.
   */
  function teamBody() {
    if (S.team) return foundTeam();
    var input = P.keyInput(
      { id: 'team-key', autocomplete: 'off', value: S.teamKey },
      function (key) {
        S.teamKey = key;
      }
    );
    return [
      h(
        'p',
        { class: 'step-help' },
        t('teamHelp', { form: S.form.keyBooking.title })
      ),
      h(
        'div',
        { class: 'field' + (S.teamError ? ' has-error' : '') },
        h('label', { class: 'label', for: 'team-key' }, t('keyLabel')),
        input,
        h(
          'p',
          { class: 'error', role: 'alert', hidden: !S.teamError },
          S.teamError
        )
      )
    ];
  }

  /** Forgets the team and its key. */
  function forgetTeam() {
    S.team = null;
    S.teamBooked = false;
    S.teamSlot = null;
    S.teamCanMove = false;
    S.sourceKey = '';
    S.teamKey = '';
    S.teamError = '';
  }

  /**
   * Takes in the team a key found and moves the focus to the step title.
   *
   * @param {!Object} res The answer of bookingTeam.
   */
  function takeTeam(res) {
    S.team = res.team;
    S.teamBooked = !!res.booked;
    S.teamSlot = res.slot || null;
    S.teamCanMove = !!res.canMove;
    S.sourceKey = S.teamKey;
    S.busy = false;
    P.render();
    var title = document.getElementById('step-title');
    if (title?.focus) title.focus({ preventScroll: true });
  }

  /**
   * Finds the team of the typed key.
   *
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function findTeam() {
    if (!P.isKey(S.teamKey)) {
      S.teamError = t('errors.bad_key');
      P.render();
      return P.focusFirstError();
    }
    S.busy = true;
    S.teamError = '';
    P.render();
    var res;
    try {
      res = await App.api.call({
        action: 'bookingTeam',
        slug: S.slug,
        key: S.teamKey
      });
    } catch (e) {
      S.busy = false;
      S.teamError = App.i18n.err({ error: e.code }) || e.message;
      P.render();
      return P.focusFirstError();
    }
    takeTeam(res);
  }

  P.teamBody = teamBody;
  P.findTeam = findTeam;
  P.forgetTeam = forgetTeam;
})(window.App);
