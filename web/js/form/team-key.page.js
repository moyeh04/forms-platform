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

  /** Step one of a key booking: the key, then the team it opens for the student to confirm. */
  function teamBody() {
    if (S.team) {
      return [
        h('p', { class: 'step-help' }, t('teamIs') + ' (' + S.team.ref + ')'),
        P.teamSummary(),
        // The key that found the team usually opens its booking too; when it does not, the key screen says so.
        S.teamBooked
          ? h(
              'div',
              { class: 'banner info', role: 'status', name: 'team-booked' },
              S.teamSlot
                ? t('teamBookedAt', {
                    when: P.displayValue(P.slotField(), S.teamSlot)
                  })
                : t('teamBooked')
            )
          : null,
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
    var input = h('input', {
      class: 'input key-input',
      id: 'team-key',
      type: 'text',
      inputmode: 'numeric',
      maxlength: '5',
      autocomplete: 'off',
      placeholder: '00000',
      value: S.teamKey
    });
    input.addEventListener('input', function () {
      input.value = S.teamKey = Rules.latinDigits(input.value)
        .replace(/\D/g, '')
        .slice(0, 5);
    });
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

  function forgetTeam() {
    S.team = null;
    S.teamBooked = false;
    S.teamSlot = null;
    S.teamCanMove = false;
    S.sourceKey = '';
    S.teamKey = '';
    S.teamError = '';
  }

  async function findTeam() {
    if (!/^\d{5}$/.test(S.teamKey)) {
      S.teamError = t('errors.bad_key');
      P.render();
      return P.focusFirstError();
    }
    S.busy = true;
    S.teamError = '';
    P.render();
    try {
      var res = await App.api.call({
        action: 'bookingTeam',
        slug: S.slug,
        key: S.teamKey
      });
      S.team = res.team;
      S.teamBooked = !!res.booked;
      S.teamSlot = res.slot || null;
      S.teamCanMove = !!res.canMove;
      S.sourceKey = S.teamKey;
      S.busy = false;
      P.render();
      var title = document.getElementById('step-title');
      if (title && title.focus) title.focus({ preventScroll: true });
    } catch (e) {
      S.busy = false;
      S.teamError = App.i18n.err({ error: e.code }) || e.message;
      P.render();
      P.focusFirstError();
    }
  }

  P.teamBody = teamBody;
  P.findTeam = findTeam;
  P.forgetTeam = forgetTeam;
})(window.App);
