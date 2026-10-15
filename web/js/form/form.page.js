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

  async function load() {
    S.view = 'loading';
    render();
    try {
      var res = await App.api.call({ action: 'getForm', slug: S.slug });
      S.form = res.form;
      S.state = res.state;
      S.taken = res.taken || {};
      var metadata = FormMetadata.display(S.form);
      document.title =
        S.form.title +
        metadata
          .map(function (item) {
            return item.variant === 'subject'
              ? ' (' + item.value + ')'
              : ' - ' + item.value;
          })
          .join('');
      var cfg = S.form.lang || {};
      var lang =
        cfg.allowSwitch === false
          ? cfg.default || 'en'
          : App.i18n.saved() || cfg.default || 'en';
      App.i18n.set(lang);
      if (S.state === 'open' || S.state === 'closed') P.buildSteps();
      if (S.state === 'open') {
        P.restoreDraft();
        S.view = 'form';
      } else S.view = 'closed';
    } catch (e) {
      S.loadError =
        e.code === 'form_not_found'
          ? t('notFound')
          : App.i18n.err({ error: e.code }) || e.message;
      S.view = 'error';
    }
    render();
  }

  async function refreshAvailability() {
    try {
      var res = await App.api.call({ action: 'getForm', slug: S.slug });
      S.taken = res.taken || {};
    } catch (e) {
      /* keep what we have */
    }
  }

  function render() {
    App.ui.clear(root);
    root.appendChild(P.topbar());
    if (S.view === 'loading')
      root.appendChild(h('div', { class: 'loading' }, t('loading')));
    else if (S.view === 'error')
      root.appendChild(
        P.sheet(
          h('h2', { class: 'state-title' }, S.loadError),
          h(
            'button',
            { type: 'button', class: 'btn btn-quiet', onclick: load },
            icon('refresh', 20),
            t('retry')
          )
        )
      );
    else if (S.view === 'closed') root.appendChild(P.closedView());
    else if (S.view === 'form') root.appendChild(P.formView());
    else if (S.view === 'keyEntry') root.appendChild(P.keyEntryView());
    else if (S.view === 'readonly') root.appendChild(P.readonlyView());
    else if (S.view === 'ticket') root.appendChild(P.ticketView());
    else if (S.view === 'cancelled') root.appendChild(P.cancelledView());
    else if (S.view === 'moved') root.appendChild(P.movedView());
  }

  App.form = { init: init, _state: S };

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

  if (!window.__FORM_NO_AUTOSTART__) init();

  P.render = render;
  P.refreshAvailability = refreshAvailability;
})(window.App);
