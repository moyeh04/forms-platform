/**
 * The public form. Renders any form definition from the backend: steps with a
 * route trail, live Arabic-only names, repeating team members, slot picking, a
 * review step, the success ticket, and edit-by-key. A reservation booked with a
 * registration key asks for the key and the slot only. This part loads the
 * form, draws the page for its state and starts it; the other parts of
 * web/js/form/ load before it.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var root = P.root;
  var S = P.S;

  /** The size of the icon on the Retry button, in pixels. */
  var RETRY_ICON_SIZE = 20;

  /** The part that draws each view of the page, by the view's name. */
  var VIEWS = {
    closed: 'closedView',
    form: 'formView',
    keyEntry: 'keyEntryView',
    readonly: 'readonlyView',
    ticket: 'ticketView',
    cancelled: 'cancelledView',
    moved: 'movedView'
  };

  /**
   * Gives the words of the bar about a newer version of the page, in the
   * language of the form.
   *
   * @return {{text: string, action: string}} The message and the button.
   */
  function freshWords() {
    return { text: t('freshReady'), action: t('freshReload') };
  }

  /**
   * Writes the title of the browser tab: the form title, then its subject
   * in brackets and its other details after dashes.
   *
   * @param {!Object} form The form.
   * @return {string} The title.
   */
  function tabTitle(form) {
    return (
      form.title +
      FormMetadata.display(form)
        .map(function (item) {
          return item.variant === 'subject'
            ? ' (' + item.value + ')'
            : ' - ' + item.value;
        })
        .join('')
    );
  }

  /**
   * Picks the page language: the form's own when it locks it, otherwise
   * the one kept on this device or the form's default.
   *
   * @param {!Object} form The form.
   * @return {string} The language.
   */
  function pageLang(form) {
    var cfg = form.lang || {};
    if (cfg.allowSwitch === false) return cfg.default || 'en';
    return App.i18n.saved() || cfg.default || 'en';
  }

  /**
   * Takes in the form the server sent and picks the view for its state.
   *
   * @param {!Object} res The answer of getForm.
   */
  function takeForm(res) {
    S.form = res.form;
    S.state = res.state;
    S.taken = res.taken || {};
    document.title = tabTitle(S.form);
    App.i18n.set(pageLang(S.form));
    if (S.state === 'open' || S.state === 'closed') P.buildSteps();
    if (S.state === 'open') {
      P.restoreDraft();
      S.view = 'form';
    } else S.view = 'closed';
  }

  /**
   * Loads the form and draws it, or the reason it cannot be opened.
   *
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function load() {
    S.view = 'loading';
    render();
    try {
      takeForm(await App.api.call({ action: 'getForm', slug: S.slug }));
    } catch (e) {
      S.loadError =
        e.code === 'form_not_found'
          ? t('notFound')
          : App.i18n.err({ error: e.code }) || e.message;
      S.view = 'error';
    }
    render();
  }

  /**
   * Reads again which slots are taken. On an error the page keeps what it
   * has.
   *
   * @return {!Promise<void>} Settles when done.
   */
  async function refreshAvailability() {
    var res;
    try {
      res = await App.api.call({ action: 'getForm', slug: S.slug });
      S.taken = res.taken || {};
    } catch {
      /* keep what we have */
    }
  }

  /**
   * Draws the reason the form cannot be opened, with a Retry button.
   *
   * @return {!Element} The sheet.
   */
  function errorView() {
    return P.sheet(
      h('h2', { class: 'state-title' }, S.loadError),
      h(
        'button',
        { type: 'button', class: 'btn btn-quiet', onclick: load },
        icon('refresh', RETRY_ICON_SIZE),
        t('retry')
      )
    );
  }

  /** Draws the page for its current view. */
  function render() {
    App.ui.clear(root);
    root.appendChild(P.topbar());
    if (S.view === 'loading') {
      root.appendChild(h('div', { class: 'loading' }, t('loading')));
    } else if (S.view === 'error') root.appendChild(errorView());
    else if (VIEWS[S.view]) root.appendChild(P[VIEWS[S.view]]());
  }

  /**
   * Starts the page for the form named in the address, as `?f=` or `#`.
   *
   * @return {!Promise<void>|undefined} Settles when the form is drawn.
   */
  function init() {
    var params = new URLSearchParams(window.location.search);
    S.slug = (
      params.get('f') ||
      window.location.hash.replace('#', '') ||
      ''
    ).trim();
    if (!S.slug) {
      S.loadError = t('notFound');
      S.view = 'error';
      return render();
    }
    return load();
  }

  P.render = render;
  P.refreshAvailability = refreshAvailability;
  App.fresh.words = freshWords;
  App.form = { init: init, _state: S };

  if (!window.__FORM_NO_AUTOSTART__) init();
})(window.App);
