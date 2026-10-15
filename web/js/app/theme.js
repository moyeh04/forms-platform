/**
 * Light, dark, or follow the device. The choice is remembered on this
 * device only.
 */
(function (App) {
  'use strict';

  /** The browser storage key of the theme a visitor chose. */
  var KEY = 'fp_theme';

  /**
   * Finds the browser storage, which a locked-down browser may refuse.
   *
   * @return {?Storage} The storage, or null.
   */
  function store() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  /**
   * Reads the theme kept on this device.
   *
   * @return {?string} 'light', 'dark', or null to follow the device.
   */
  function stored() {
    var s = store();
    return s ? s.getItem(KEY) : null;
  }

  /**
   * Says which theme the page shows now.
   *
   * @return {string} 'dark' or 'light'.
   */
  function effective() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    var dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return dark ? 'dark' : 'light';
  }

  /**
   * Shows a theme, or follows the device for anything else.
   *
   * @param {?string} t 'light' or 'dark'.
   */
  function apply(t) {
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else document.documentElement.removeAttribute('data-theme');
  }

  /** Shows the theme kept on this device. */
  function init() {
    apply(stored());
  }

  /**
   * Switches to the other theme and keeps it on this device.
   *
   * @return {string} The theme now shown.
   */
  function toggle() {
    var next = effective() === 'dark' ? 'light' : 'dark';
    apply(next);
    var s = store();
    if (s) s.setItem(KEY, next);
    return next;
  }

  App.theme = { init: init, effective: effective, toggle: toggle };
  App.theme.init();
})(window.App);
