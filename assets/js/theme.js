/** Light, dark, or follow the device. The choice is remembered on this device only. */
(function (App) {
  'use strict';
  var KEY = 'fp_theme';
  function store() { try { return window.localStorage; } catch (e) { return null; } }

  function stored() { var s = store(); return s ? s.getItem(KEY) : null; }

  function effective() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  App.theme = {
    init: function () { apply(stored()); },
    effective: effective,
    toggle: function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      apply(next);
      var s = store();
      if (s) s.setItem(KEY, next);
      return next;
    }
  };
  App.theme.init();
})(window.App = window.App || {});
