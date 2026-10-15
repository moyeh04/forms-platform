/**
 * The dashboard shell: reads the address, draws the bar and the page it
 * names, and keeps a page with unsaved changes until the admin agrees to
 * leave it. Loaded last of the shell parts; the page starts it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var started = false;

  /** The address drawn now, put back when the admin stays on a page. */
  var shown = '';

  /** The pages that belong to the Forms section of the bar. */
  var FORM_PAGES = ['responses', 'settings', 'create'];

  /**
   * Reads the page the address names, as `#/`, `#/new`, `#/clients`,
   * `#/lists/<key>` or `#/f/<slug>/<tab>`.
   *
   * @return {{name: string, args: !Array<string>}} The page and what it is
   *     given.
   */
  function route() {
    var parts = (window.location.hash || '')
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
    if (!parts.length) return { name: 'forms', args: [] };
    if (parts[0] === 'new') return { name: 'create', args: [] };
    if (parts[0] === 'clients') return { name: 'clients', args: [] };
    if (parts[0] === 'lists') return { name: 'lists', args: [parts[1] || ''] };
    if (parts[0] !== 'f' || !parts[1]) return { name: 'forms', args: [] };
    return A.FORM_TABS.indexOf(parts[2]) > 0
      ? { name: 'settings', args: [parts[1], parts[2]] }
      : { name: 'responses', args: [parts[1]] };
  }

  /**
   * Draws a link of the bar.
   *
   * @param {string} href Its address.
   * @param {string} text Its words.
   * @param {boolean} active True when its section is shown.
   * @return {!Element} The link.
   */
  function navLink(href, text, active) {
    return h('a', { href: href, 'aria-current': active ? 'page' : null }, text);
  }

  /**
   * Signs this window out and draws the PIN screen.
   */
  function logOut() {
    App.api.setPin('');
    render();
  }

  /**
   * Draws the bar: the sections, the theme switch and Log out.
   *
   * @param {string} group The section shown.
   * @return {!Element} The bar.
   */
  function bar(group) {
    return h(
      'header',
      { class: 'admin-bar' },
      h('h1', null, 'Forms dashboard'),
      h(
        'nav',
        { class: 'admin-nav', 'aria-label': 'Sections' },
        navLink('#/', 'Forms', group === 'forms'),
        navLink('#/clients', 'Clients', group === 'clients'),
        navLink('#/lists', 'Lists', group === 'lists')
      ),
      App.ui.themeButton(),
      h(
        'button',
        {
          type: 'button',
          class: 'icon-btn',
          'aria-label': 'Log out',
          onclick: logOut
        },
        App.ui.icon('logout', A.ICON_SIZE.BUTTON),
        h('span', { class: 'btn-text' }, 'Log out')
      )
    );
  }

  /**
   * Draws the page the address names, or the PIN screen when this window
   * is signed out. A page that cannot load says why; a wrong PIN signs the
   * window out.
   *
   * @return {!Promise} Settles when the page is drawn.
   */
  async function render() {
    var root = document.getElementById('app');
    A.unsaved = false;
    App.ui.clear(root);
    if (!App.api.getPin()) return A.loginView(root);
    var r = route();
    var mount = h(
      'main',
      { id: 'main' },
      h('div', { class: 'loading' }, 'Loading...')
    );
    var group = FORM_PAGES.indexOf(r.name) === -1 ? r.name : 'forms';
    root.appendChild(h('div', { class: 'admin-page' }, bar(group), mount));
    try {
      await A.views[r.name].apply(null, [mount].concat(r.args));
    } catch (e) {
      App.ui.clear(mount);
      mount.appendChild(
        h('div', { class: 'banner' }, e.message || 'Could not load this page.')
      );
      if (e.code === 'bad_pin') logOut();
    }
  }

  /**
   * Asks the admin whether to leave a page with unsaved changes. Staying
   * puts the address back.
   *
   * @return {!Promise<boolean>} True to leave.
   */
  async function mayLeave() {
    if (window.location.hash === shown) return false;
    var leave = await App.ui.confirm({
      title: 'Leave without saving?',
      body: 'Your changes on this page are not saved.',
      confirmText: 'Leave',
      danger: true
    });
    if (!leave) window.location.hash = shown;
    return leave;
  }

  /**
   * Draws the page of a new address. A page with unsaved changes
   * (A.unsaved) is left only after the admin agrees.
   *
   * @return {!Promise} Settles when the page is drawn or kept.
   */
  async function onHashChange() {
    if (A.unsaved && !(await mayLeave())) return;
    shown = window.location.hash;
    render();
  }

  /**
   * Asks the browser to confirm closing a page with unsaved changes.
   *
   * @param {!BeforeUnloadEvent} e The event.
   */
  function onBeforeUnload(e) {
    if (A.unsaved) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  /**
   * Closes every open More menu the click was not in.
   *
   * @param {!MouseEvent} e The click.
   */
  function closeMenus(e) {
    document.querySelectorAll('details.more[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.open = false;
    });
  }

  /**
   * Changes the address without drawing the page again.
   *
   * @param {string} hash The new address.
   */
  A.setHash = function (hash) {
    window.history.replaceState(null, '', hash);
    shown = hash;
  };

  /**
   * Starts the dashboard: listens to the address once, then draws the
   * page.
   *
   * @return {!Promise} Settles when the page is drawn.
   */
  A.start = function () {
    if (!started) {
      started = true;
      shown = window.location.hash;
      window.addEventListener('hashchange', onHashChange);
      window.addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('click', closeMenus);
    }
    return render();
  };

  A.render = render;
})(window.App);
