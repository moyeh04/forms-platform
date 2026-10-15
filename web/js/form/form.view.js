/**
 * The page of an open form: the steps and their questions, the buttons that
 * move between them, and the page of a closed form. With a key it opens on the
 * summary.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  function closedView() {
    var key =
      {
        closed: 'closed',
        not_yet: 'notYet',
        draft: 'draft',
        archived: 'closed'
      }[S.state] || 'closed';
    var msg =
      S.form.messages && S.form.messages[key]
        ? L(S.form.messages[key])
        : t(key);
    return P.sheet(
      P.head(),
      h('h2', { class: 'state-title' }, msg),
      editLink()
    );
  }

  function editLink() {
    if (!S.form.editKey || !S.form.editKey.enabled || !S.form.fields)
      return null;
    return h(
      'p',
      { class: 'foot' },
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          onclick: function () {
            S.view = 'keyEntry';
            S.keyError = '';
            P.render();
          }
        },
        t('editLink')
      )
    );
  }

  /** With a key the form is not a path: it opens on the summary, and each page is reached from there and returns to it. */
  function hub() {
    return S.mode === 'edit';
  }

  function changed() {
    return JSON.stringify(S.data) !== S.original;
  }

  function formView() {
    var step = S.steps[S.stepIndex];
    var title = h(
      'h2',
      { class: 'step-title', tabindex: '-1', id: 'step-title' },
      step.review
        ? t(hub() ? 'yourRegistration' : 'reviewTitle')
        : P.stepTitle(step)
    );
    var body = step.review
      ? P.reviewBody()
      : step.team
        ? P.teamBody()
        : step.fields.map(function (f) {
            return P.renderField(f, f.id);
          });
    var last = S.stepIndex === S.steps.length - 1;
    var primary = h(
      'button',
      { type: 'submit', class: 'btn btn-primary', disabled: S.busy },
      last
        ? S.busy
          ? t('submitting')
          : t(
              S.mode === 'edit'
                ? 'saveChanges'
                : P.keyMode()
                  ? 'book'
                  : 'submit'
            )
        : hub()
          ? t('done')
          : t(step.team && !S.team ? 'findTeam' : 'next'),
      last || hub() ? null : icon('arrow', 20)
    );
    // A team that has booked does not book again: its button opens the booking, at the time when it can move.
    if (step.team && S.team && S.teamBooked) {
      primary = h(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          name: 'open-booking',
          disabled: S.busy,
          onclick: function () {
            S.view = 'keyEntry';
            S.keyError = '';
            P.openByKey(S.sourceKey, S.teamCanMove);
          }
        },
        t(S.teamCanMove ? 'moveTime' : 'editOpen'),
        icon('arrow', 20)
      );
    }
    // Save exists only when an answer differs from the saved registration.
    if (hub() && last && !changed())
      primary = h('p', { class: 'help no-changes' }, t('noChanges'));
    var back =
      S.stepIndex > 0 && !hub()
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet',
              onclick: function () {
                P.go(S.stepIndex - 1);
              }
            },
            t('back')
          )
        : null;
    // The summary of a registration opened with a key is also the way out of it.
    if (hub() && last) back = P.closeButton();
    var nav = h('div', { class: 'nav' }, back, primary);
    var help = !step.review
      ? null
      : hub()
        ? t(P.slotOnly() ? 'yourBookingHelp' : 'yourRegistrationHelp')
        : t(
            S.form.editKey && S.form.editKey.enabled
              ? 'reviewHelpKey'
              : 'reviewHelp'
          );
    var f = h(
      'form',
      {
        novalidate: 'novalidate',
        onsubmit: function (e) {
          e.preventDefault();
          if (!S.busy) P.next();
        }
      },
      title,
      help ? h('p', { class: 'step-help' }, help) : null,
      body,
      nav
    );
    var edit =
      S.mode === 'edit'
        ? h(
            'div',
            { class: 'banner info', role: 'status' },
            t('editing', { ref: S.keyInfo.ref }) +
              '. ' +
              t('keyUntil', { date: App.i18n.fmtDate(S.keyInfo.keyExpires) })
          )
        : null;
    var cancel =
      S.mode === 'edit' && S.keyInfo.canDelete && last
        ? h(
            'p',
            { class: 'foot' },
            h(
              'button',
              { type: 'button', class: 'link-btn', onclick: P.askCancel },
              t('cancelReg')
            )
          )
        : null;
    // A booking made with a team's key starts with that key, so the page asks for a key in one place only:
    // a team that has booked is told so there, with the way to its booking.
    return P.sheet(
      P.head(),
      edit,
      hub() ? P.transferNotes() : null,
      hub() ? null : P.trail(),
      P.bannerEl(),
      f,
      cancel,
      S.mode === 'new' && S.stepIndex === 0 && !P.keyMode() ? editLink() : null
    );
  }

  P.closedView = closedView;
  P.formView = formView;
  P.hub = hub;
  P.changed = changed;
})(window.App);
