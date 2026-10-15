/**
 * Keeps an open page on the version of the site that is published.
 * GitHub Pages lets a browser keep a file for ten minutes and a tab can stay open for days, so a
 * page can be older than the site. The build writes the version of the site into config.js and
 * into version.json. This file compares the two when the page opens, when its tab is looked at
 * again, and every few minutes. An older page reloads itself when nothing would be lost; when
 * something was typed or a dialog is open, it offers a Reload button instead.
 * A preview has no version, so nothing happens there.
 */
(function (App) {
  'use strict';

  var mine = '';
  var EVERY = 5 * 60 * 1000, GAP = 30 * 1000, TRIED = 'fp_fresh_tried';
  var touched = false, checking = false, last = 0, bar = null, published = '';

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }

  var F = App.fresh = {
    /** The version that is published now, or '' when it cannot be read. The address is new every time, so no cache answers. */
    read: function () {
      return window.fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return String((j && j.version) || ''); })
        .catch(function () { return ''; });
    },
    reload: function () { window.location.reload(); },
    /** The words of the bar. A page in another language gives its own. */
    words: function () { return { text: 'A newer version of this page is ready.', action: 'Reload' }; },
    check: check,
    start: start
  };

  /** Reloading now would lose something: the visitor typed or chose something, or a dialog is open. */
  function inUse() { return touched || !!document.querySelector('.overlay'); }

  function show() {
    if (!bar) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary sm';
      button.name = 'fresh-reload';
      button.addEventListener('click', go);
      bar = document.createElement('div');
      bar.className = 'fresh-bar';
      bar.setAttribute('role', 'status');
      bar.appendChild(document.createElement('span'));
      bar.appendChild(button);
      document.body.insertBefore(bar, document.body.firstChild);
    }
    // Written again on every check and when the page changes language.
    var w = F.words();
    bar.firstChild.textContent = w.text;
    bar.lastChild.textContent = w.action;
  }

  /** Reloads for the published version, and remembers it so the same tab never reloads for it by itself again. */
  function go() {
    var s = store();
    if (s) s.setItem(TRIED, published);
    F.reload();
  }

  function hide() {
    if (bar) bar.remove();
    bar = null;
  }

  /** Compares this page with the published site. `now` skips the wait between two checks. */
  function check(now) {
    if (!mine || checking || (!now && Date.now() - last < GAP)) return Promise.resolve();
    checking = true;
    last = Date.now();
    return F.read().then(function (version) {
      checking = false;
      if (!version || version === mine) return hide();
      published = version;
      var s = store();
      // A page that already reloaded for this version and is still old was given the old copy again: offer the button, never reload in a loop.
      var tried = s && s.getItem(TRIED) === version;
      if (tried || inUse()) return show();
      go();
    });
  }

  /** Starts watching, for a page of the given version. Without a version, or a second time, it does nothing. */
  function start(version) {
    if (mine || !version) return Promise.resolve();
    mine = String(version);
    ['input', 'change'].forEach(function (type) { document.addEventListener(type, function () { touched = true; }, true); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    // A page brought back by the Back button is shown as it was left, without loading anything.
    window.addEventListener('pageshow', function (e) { if (e.persisted) check(true); });
    window.setInterval(function () { if (!document.hidden) check(); }, EVERY);
    // A page that learns its language after it opened says the bar again in that language.
    new window.MutationObserver(function () { if (bar) show(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    // The first check waits for the scripts of the page, so the bar has the words of the page.
    if (document.readyState !== 'loading') return check(true);
    return new Promise(function (done) {
      document.addEventListener('DOMContentLoaded', function () { check(true).then(done); });
    });
  }

  start((window.APP_CONFIG || {}).VERSION);
})(window.App = window.App || {});
