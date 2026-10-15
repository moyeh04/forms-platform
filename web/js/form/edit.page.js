/**
 * A registration opened with its key: read only after the deadline, the Close
 * button, cancelling it, and starting a new one.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var S = P.S;

  /** The size of the icon on the cancel button, in pixels. */
  var BUTTON_ICON_SIZE = 20;

  /**
   * Draws the answers of every step, read only.
   *
   * @return {!Array<!Element>} A block per step.
   */
  function answerGroups() {
    return S.steps
      .filter(function (s) {
        return !s.review;
      })
      .map(function (s) {
        return h(
          'div',
          null,
          h('h3', { class: 'member-title' }, P.stepTitle(s)),
          P.summaryList(s)
        );
      });
  }

  /**
   * Draws a registration that can no longer be changed, with Close and,
   * when allowed, the cancel button.
   *
   * @return {!Element} The sheet.
   */
  function readonlyView() {
    var why = t(S.keyInfo.locked ? 'deadlineLocked' : 'readOnly');
    var cancel = S.keyInfo.canDelete
      ? h(
          'button',
          { type: 'button', class: 'btn btn-danger', onclick: askCancel },
          icon('trash', BUTTON_ICON_SIZE),
          t('cancelReg')
        )
      : null;
    return P.sheet(
      P.head(),
      h(
        'div',
        { class: 'banner info', role: 'status' },
        t('editing', { ref: S.keyInfo.ref }) + '. ' + why
      ),
      P.transferNotes(),
      P.bannerEl(),
      answerGroups(),
      h('div', { class: 'nav' }, closeButton(), cancel)
    );
  }

  /**
   * Asks before leaving a registration with changes that were not saved.
   *
   * @return {!Promise<boolean>} True to leave.
   */
  function confirmLeave() {
    return App.ui.confirm({
      title: t('leaveTitle'),
      body: t('leaveBody'),
      confirmText: t('leaveYes'),
      cancelText: t('leaveNo'),
      danger: true
    });
  }

  /**
   * Makes the button that leaves a registration opened with a key.
   * Changes that were not saved are lost only after a yes.
   *
   * @return {!Element} The button.
   */
  function closeButton() {
    var unsaved = S.view === 'form' && P.changed();
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        name: 'close-edit',
        onclick: async function () {
          if (unsaved && !(await confirmLeave())) return;
          resetForNew();
        }
      },
      t(unsaved ? 'closeUnsaved' : 'closeEdit')
    );
  }

  /**
   * Cancels the registration after a yes.
   *
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function askCancel() {
    var yes = await App.ui.confirm({
      title: t('cancelTitle'),
      body: t('cancelBody'),
      confirmText: t('cancelYes'),
      cancelText: t('cancelNo'),
      danger: true
    });
    if (!yes) return;
    try {
      await App.api.call({ action: 'remove', slug: S.slug, key: S.key });
      S.view = 'cancelled';
    } catch (e) {
      S.banner = {
        kind: 'err',
        text: App.i18n.err({ error: e.code }) || e.message
      };
    }
    P.render();
  }

  /**
   * Draws the page after a registration was cancelled.
   *
   * @return {!Element} The sheet.
   */
  function cancelledView() {
    return P.sheet(
      P.head(),
      h('h2', { class: 'state-title' }, t('cancelledTitle')),
      h('p', null, t('cancelledBody')),
      h(
        'div',
        { class: 'nav' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary',
            onclick: function () {
              resetForNew();
            }
          },
          t('newRegistration')
        )
      )
    );
  }

  /** Leaves the registration and starts a new one. */
  function resetForNew() {
    S.mode = 'new';
    S.key = '';
    S.keyInfo = null;
    S.data = {};
    S.errors = {};
    S.banner = null;
    S.stepIndex = 0;
    S.ownSlot = '';
    P.forgetTeam();
    P.buildSteps();
    P.refreshAvailability().then(function () {
      S.view = S.state === 'open' ? 'form' : 'closed';
      P.render();
    });
  }

  P.readonlyView = readonlyView;
  P.cancelledView = cancelledView;
  P.closeButton = closeButton;
  P.askCancel = askCancel;
  P.resetForNew = resetForNew;
})(window.App);
