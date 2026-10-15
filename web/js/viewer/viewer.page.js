/**
 * The page behind a private instructor or client link.
 * Read-only: no PIN, no Google account. The admin chooses the forms and the
 * columns that appear here, and can turn the link off at any time.
 */
(function (App) {
  'use strict';

  var V = App.viewer;
  var S = V.state;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  /**
   * Opens the link in the address.
   *
   * @return {!Promise} Settles once the page is drawn.
   */
  V.start = async function () {
    var p = V.params();
    S.token = p.t;
    S.slug = p.f;
    if (!S.token) {
      S.error = 'This link is missing its access code. Ask for a new one.';
      return V.render();
    }
    S.key = V.storedKey();
    await V.open();
  };

  /**
   * Keeps the form in the address when the link shows it, or else picks
   * the first form of the link.
   */
  function pickForm() {
    var known = S.me.forms.some(function (f) {
      return f.slug === S.slug;
    });
    if (!known) S.slug = S.me.forms[0] ? S.me.forms[0].slug : '';
  }

  /**
   * Takes a refused open: a link that needs its key, or a right one, asks
   * for it; any other reason shows the link cannot be opened.
   *
   * @param {!Error} e Why it was refused.
   */
  function refused(e) {
    if (V.KEY_ERRORS.indexOf(e.code) === -1) {
      S.error = e.message;
      return;
    }
    // A stored key that stopped working (a new key was made) is forgotten.
    V.storeKey('');
    S.askKey = true;
    S.keyError = e.code === 'key_needed' ? '' : e.message;
  }

  /**
   * Asks who the link is, picks the form in the address or the first one,
   * and loads it.
   *
   * @return {!Promise} Settles once the page is drawn.
   */
  V.open = async function () {
    try {
      S.me = await V.call('viewer.me');
      S.askKey = false;
      S.keyError = '';
      V.storeKey(S.key);
      pickForm();
      if (S.slug) await V.load();
    } catch (e) {
      refused(e);
    }
    V.render();
  };

  /**
   * Loads the open form again and draws the page.
   *
   * @param {string=} msg What to say once it is loaded.
   * @return {!Promise} Settles once the page is drawn.
   */
  V.reload = async function (msg) {
    try {
      await V.load();
      if (msg) toast(msg, 'ok');
    } catch (e) {
      toast(e.message, 'err');
    }
    V.render();
  };

  /**
   * Draws the bar at the top: the form, its metadata, who the link is and
   * the theme switch.
   *
   * @param {?Object} d The data of the open form.
   * @return {!Element} The bar.
   */
  function topBar(d) {
    return h(
      'header',
      { class: 'admin-bar' },
      h('h1', null, d ? d.form.title : 'Registrations'),
      d &&
        FormMetadata.display(d.form).map(function (item) {
          return h(
            'span',
            {
              class:
                'tag-sm' + (item.variant === 'subject' ? ' tag-subject' : '')
            },
            item.value
          );
        }),
      h('span', { class: 'muted-note' }, 'Viewing as ' + S.me.client.name),
      ui.themeButton()
    );
  }

  /** Draws the rows of the open form, by its kind. */
  V.paintBody = function () {
    var body = document.getElementById('body');
    if (!body) return;
    ui.clear(body);
    var d = S.data;
    var node =
      d.kind === 'reservation'
        ? V.bookings(d)
        : d.kind === 'team'
          ? V.teams(d)
          : V.registrations(d);
    body.appendChild(node);
  };

  /** Draws the page: the reason the link cannot open, its key, or a form. */
  V.render = function () {
    var root = document.getElementById('app');
    var el;
    ui.clear(root);
    if (S.error) {
      root.appendChild(V.closedView(S.error));
      return;
    }
    if (S.askKey) {
      root.appendChild(V.keyView());
      el = document.getElementById('access-key');
      if (el) el.focus();
      return;
    }
    var d = S.data;
    var page = h('div', { class: 'admin-page' }, topBar(d));
    root.appendChild(page);
    if (!d) {
      page.appendChild(
        h('div', { class: 'empty' }, 'No forms have been shared with you yet.')
      );
      return;
    }
    page.appendChild(V.toolbar(d));
    page.appendChild(h('div', { id: 'body' }));
    V.paintBody();
  };
})(window.App);
