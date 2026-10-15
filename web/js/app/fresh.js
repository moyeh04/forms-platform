/**
 * Keeps an open page on the version of the site that is published.
 *
 * GitHub Pages lets a browser keep a file for ten minutes and a tab can
 * stay open for days, so a page can be older than the site. The build
 * writes the version of the site into config.js and into version.json.
 * This file compares the two when the page opens, when its tab is looked
 * at again, and every few minutes. An older page reloads itself when
 * nothing would be lost; when something was typed or a dialog is open, it
 * offers a Reload button instead. A preview has no version, so nothing
 * happens there.
 */
(function (App) {
  'use strict';

  /** One second, in milliseconds. */
  var SECOND = 1000;

  /** One minute, in milliseconds. */
  var MINUTE = 60 * SECOND;

  /** How many minutes apart an open page checks, while its tab is shown. */
  var EVERY_MINUTES = 5;

  /** The fewest seconds between two checks that do not insist. */
  var GAP_SECONDS = 30;

  var EVERY = EVERY_MINUTES * MINUTE;
  var GAP = GAP_SECONDS * SECOND;

  /** The session storage key of the version this tab reloaded for. */
  var TRIED = 'fp_fresh_tried';

  var mine = '';
  var touched = false;
  var checking = false;
  var last = 0;
  var bar = null;
  var published = '';

  /**
   * Finds the session storage, which a locked-down browser may refuse.
   *
   * @return {?Storage} The storage, or null.
   */
  function store() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  /**
   * Reads the version that is published now. The address is new every
   * time, so no cache answers.
   *
   * @return {!Promise<string>} The version, or '' when it cannot be read.
   */
  function read() {
    return window
      .fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (j) {
        return String(j?.version || '');
      })
      .catch(function () {
        return '';
      });
  }

  /** Loads the page again. */
  function reload() {
    window.location.reload();
  }

  /**
   * Gives the words of the bar. A page in another language gives its own.
   *
   * @return {{text: string, action: string}} The message and the button.
   */
  function words() {
    return {
      text: 'A newer version of this page is ready.',
      action: 'Reload'
    };
  }

  /**
   * Says whether reloading now would lose something: the visitor typed or
   * chose something, or a dialog is open.
   *
   * @return {boolean} True when the page is in use.
   */
  function inUse() {
    return touched || !!document.querySelector('.overlay');
  }

  /**
   * Makes the bar with its Reload button, at the top of the page.
   *
   * @return {!Element} The bar.
   */
  function makeBar() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary sm';
    button.name = 'fresh-reload';
    button.addEventListener('click', go);
    var made = document.createElement('div');
    made.className = 'fresh-bar';
    made.setAttribute('role', 'status');
    made.appendChild(document.createElement('span'));
    made.appendChild(button);
    document.body.insertBefore(made, document.body.firstChild);
    return made;
  }

  /**
   * Shows the bar. Its words are written again on every check and when the
   * page changes language.
   */
  function show() {
    if (!bar) bar = makeBar();
    var w = F.words();
    bar.firstChild.textContent = w.text;
    bar.lastChild.textContent = w.action;
  }

  /**
   * Reloads for the published version, and remembers it so the same tab
   * never reloads for it by itself again.
   */
  function go() {
    var s = store();
    if (s) s.setItem(TRIED, published);
    F.reload();
  }

  /** Removes the bar. */
  function hide() {
    if (bar) bar.remove();
    bar = null;
  }

  /**
   * Acts on the version that is published: nothing when it is this page's,
   * otherwise a reload or the bar. A page that already reloaded for this
   * version and is still old was given the old copy again, so it gets the
   * bar and never reloads in a loop.
   *
   * @param {string} version The published version, or ''.
   */
  function compare(version) {
    checking = false;
    if (!version || version === mine) {
      hide();
      return;
    }
    published = version;
    var s = store();
    var tried = s && s.getItem(TRIED) === version;
    if (tried || inUse()) show();
    else go();
  }

  /**
   * Compares this page with the published site.
   *
   * @param {boolean=} now True to skip the wait between two checks.
   * @return {!Promise<void>} Settles when the check is done.
   */
  function check(now) {
    var soon = !now && Date.now() - last < GAP;
    if (!mine || checking || soon) return Promise.resolve();
    checking = true;
    last = Date.now();
    return F.read().then(compare);
  }

  /** Notes that the visitor typed or chose something. */
  function touch() {
    touched = true;
  }

  /** Checks when the tab is shown, unless the wait is not over. */
  function checkIfShown() {
    if (!document.hidden) check();
  }

  /**
   * Listens for what should start a check: the tab shown again, the Back
   * button, the clock, and a change of the page language.
   */
  function listen() {
    document.addEventListener('input', touch, true);
    document.addEventListener('change', touch, true);
    document.addEventListener('visibilitychange', checkIfShown);
    // A page brought back by the Back button is shown as it was left,
    // without loading anything.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) check(true);
    });
    window.setInterval(checkIfShown, EVERY);
    // A page that learns its language after it opened says the bar again in
    // that language.
    new window.MutationObserver(function () {
      if (bar) show();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });
  }

  /**
   * Starts watching, for a page of the given version. Without a version,
   * or a second time, it does nothing. The first check waits for the
   * scripts of the page, so the bar has the words of the page.
   *
   * @param {*} version The version of this page.
   * @return {!Promise<void>} Settles when the first check is done.
   */
  function start(version) {
    if (mine || !version) return Promise.resolve();
    mine = String(version);
    listen();
    if (document.readyState !== 'loading') return check(true);
    return new Promise(function (done) {
      document.addEventListener('DOMContentLoaded', function () {
        check(true).then(done);
      });
    });
  }

  var F = {
    read: read,
    reload: reload,
    words: words,
    check: check,
    start: start
  };
  App.fresh = F;

  var config = window.APP_CONFIG || {};
  start(config.VERSION);
})(window.App);
