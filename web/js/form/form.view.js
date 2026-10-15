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

  /** The size of the arrow on the forward buttons, in pixels. */
  var ARROW_SIZE = 20;

  /** The message of each state of a form that cannot be answered. */
  var CLOSED_TEXT = {
    closed: 'closed',
    not_yet: 'notYet',
    draft: 'draft',
    archived: 'closed'
  };

  /**
   * Draws the page of a form that cannot be answered now, with the
   * message the admin set or the default one.
   *
   * @return {!Element} The sheet.
   */
  function closedView() {
    var key = CLOSED_TEXT[S.state] || 'closed';
    var messages = S.form.messages || {};
    var msg = messages[key] ? L(messages[key]) : t(key);
    return P.sheet(
      P.head(),
      h('h2', { class: 'state-title' }, msg),
      editLink()
    );
  }

  /**
   * Draws the link to the page that asks for a key.
   *
   * @return {?Element} The link, or null when the form has no keys.
   */
  function editLink() {
    if (!S.form.editKey?.enabled || !S.form.fields) return null;
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

  /**
   * Says whether the form is a hub. With a key the form is not a path: it
   * opens on the summary, and each page is reached from there and returns
   * to it.
   *
   * @return {boolean} True for a registration opened with its key.
   */
  function hub() {
    return S.mode === 'edit';
  }

  /**
   * Says whether an answer differs from the saved registration.
   *
   * @return {boolean} True when something changed.
   */
  function changed() {
    return JSON.stringify(S.data) !== S.original;
  }

  /**
   * Draws the questions of a step, or the review or the team of a key
   * booking.
   *
   * @param {!Object} step The step.
   * @return {*} The body of the step.
   */
  function stepBody(step) {
    if (step.review) return P.reviewBody();
    if (step.team) return P.teamBody();
    return step.fields.map(function (f) {
      return P.renderField(f, f.id);
    });
  }

  /**
   * Gives the words of the button that sends the form.
   *
   * @return {string} The words.
   */
  function sendLabel() {
    if (S.busy) return t('submitting');
    if (S.mode === 'edit') return t('saveChanges');
    return t(P.keyMode() ? 'book' : 'submit');
  }

  /**
   * Makes the button that goes on: to the next step, back to the summary,
   * or sending the form on the last step.
   *
   * @param {!Object} step The step.
   * @param {boolean} last True on the last step.
   * @return {!Element} The button.
   */
  function forwardButton(step, last) {
    var label = t(step.team && !S.team ? 'findTeam' : 'next');
    if (hub()) label = t('done');
    if (last) label = sendLabel();
    return h(
      'button',
      { type: 'submit', class: 'btn btn-primary', disabled: S.busy },
      label,
      last || hub() ? null : icon('arrow', ARROW_SIZE)
    );
  }

  /**
   * Makes the button of a team that has booked. It does not book again:
   * it opens the booking, at the time when it can move.
   *
   * @return {!Element} The button.
   */
  function openBookingButton() {
    return h(
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
      icon('arrow', ARROW_SIZE)
    );
  }

  /**
   * Makes the main button of a step. Save exists only when an answer
   * differs from the saved registration.
   *
   * @param {!Object} step The step.
   * @param {boolean} last True on the last step.
   * @return {!Element} The button, or the note that nothing changed.
   */
  function primaryButton(step, last) {
    if (step.team && S.team && S.teamBooked) return openBookingButton();
    if (hub() && last && !changed()) {
      return h('p', { class: 'help no-changes' }, t('noChanges'));
    }
    return forwardButton(step, last);
  }

  /**
   * Makes the button that goes back. The summary of a registration opened
   * with a key is also the way out of it.
   *
   * @param {boolean} last True on the last step.
   * @return {?Element} The button, or null on the first step.
   */
  function backButton(last) {
    if (hub()) return last ? P.closeButton() : null;
    if (S.stepIndex === 0) return null;
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        onclick: function () {
          P.go(S.stepIndex - 1);
        }
      },
      t('back')
    );
  }

  /**
   * Gives the help under the title of the review.
   *
   * @param {!Object} step The step.
   * @return {string} The help, or '' on other steps.
   */
  function stepHelp(step) {
    if (!step.review) return '';
    if (hub()) {
      return t(P.slotOnly() ? 'yourBookingHelp' : 'yourRegistrationHelp');
    }
    return t(S.form.editKey?.enabled ? 'reviewHelpKey' : 'reviewHelp');
  }

  /**
   * Draws the form of the current step: its title, help, body and buttons.
   *
   * @param {!Object} step The step.
   * @param {boolean} last True on the last step.
   * @return {!Element} The form.
   */
  function stepForm(step, last) {
    var heading = step.review
      ? t(hub() ? 'yourRegistration' : 'reviewTitle')
      : P.stepTitle(step);
    var help = stepHelp(step);
    return h(
      'form',
      {
        novalidate: 'novalidate',
        onsubmit: function (e) {
          e.preventDefault();
          if (!S.busy) P.next();
        }
      },
      h(
        'h2',
        { class: 'step-title', tabindex: '-1', id: 'step-title' },
        heading
      ),
      help ? h('p', { class: 'step-help' }, help) : null,
      step.review && hub() ? P.progressBlock(S.progress) : null,
      stepBody(step),
      h('div', { class: 'nav' }, backButton(last), primaryButton(step, last))
    );
  }

  /**
   * Draws the note that a registration is open for editing, and until when
   * its key works.
   *
   * @return {?Element} The note, or null for a new registration.
   */
  function editBanner() {
    if (S.mode !== 'edit') return null;
    var until = App.i18n.fmtDate(S.keyInfo.keyExpires);
    return h(
      'div',
      { class: 'banner info', role: 'status' },
      t('editing', { ref: S.keyInfo.ref }) +
        '. ' +
        t('keyUntil', { date: until })
    );
  }

  /**
   * Draws the link that cancels the registration, on its summary.
   *
   * @param {boolean} last True on the last step.
   * @return {?Element} The link, or null.
   */
  function cancelLink(last) {
    if (S.mode !== 'edit' || !S.keyInfo.canDelete || !last) return null;
    return h(
      'p',
      { class: 'foot' },
      h(
        'button',
        { type: 'button', class: 'link-btn', onclick: P.askCancel },
        t('cancelReg')
      )
    );
  }

  /**
   * Draws the page of an open form. A booking made with a team's key starts
   * with that key, so the page asks for a key in one place only: a team
   * that has booked is told so there, with the way to its booking.
   *
   * @return {!Element} The sheet.
   */
  function formView() {
    var step = S.steps[S.stepIndex];
    var last = S.stepIndex === S.steps.length - 1;
    var first = S.mode === 'new' && S.stepIndex === 0 && !P.keyMode();
    return P.sheet(
      P.head(),
      editBanner(),
      hub() ? P.transferNotes() : null,
      hub() ? null : P.trail(),
      P.bannerEl(),
      stepForm(step, last),
      cancelLink(last),
      first ? editLink() : null
    );
  }

  P.closedView = closedView;
  P.formView = formView;
  P.hub = hub;
  P.changed = changed;
})(window.App);
