/** Small DOM helpers, inline icons, dialogs, and clipboard. No framework. */
(function (App) {
  'use strict';

  var ICONS = {
    team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15.5 14.3c2.7-.4 5 1.3 5 4.2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M8 17h2"/>',
    task: '<path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4"/><path d="M8.5 13.5l2 2 4-4.5"/>',
    chat: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-8l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 19h14"/>',
    printer: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    arrow: '<path d="M4 12h15M14 6l6 6-6 6"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
    logout: '<path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9"/>'
  };

  function icon(name, size) {
    var s = document.createElement('span');
    s.className = 'icon icon-' + name;
    s.setAttribute('aria-hidden', 'true');
    var px = size || 22;
    s.innerHTML = '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return s;
  }

  /** h('div', { class: 'x', onclick: fn }, child, 'text', [more]) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'readOnly') { if (v) el[k] = true; }
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, c) {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else if (c.nodeType) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function toast(message, kind) {
    var host = document.getElementById('toasts');
    if (!host) { host = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(host); }
    var t = h('div', { class: 'toast' + (kind ? ' toast-' + kind : '') }, message);
    host.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3600);
  }

  /** A promise-based confirmation, styled like the rest of the page. */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var done = function (v) { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); resolve(v); };
      var yes = h('button', { type: 'button', class: 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary'), onclick: function () { done(true); } }, o.confirmText || 'OK');
      var no = h('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { done(false); } }, o.cancelText || 'Cancel');
      var overlay = h('div', { class: 'overlay', onclick: function (e) { if (e.target === overlay) done(false); } },
        h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
          h('h2', { class: 'dialog-title' }, o.title),
          o.body ? h('p', null, o.body) : null,
          h('div', { class: 'dialog-actions' }, no, yes)));
      document.body.appendChild(overlay);
      no.focus();
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through */ }
    var ta = h('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function formIcon(name) {
    return { team: 'team', calendar: 'calendar', task: 'task', chat: 'chat' }[name] || null;
  }

  App.ui = { h: h, icon: icon, clear: clear, toast: toast, confirm: confirmDialog, copyText: copyText, formIcon: formIcon };
})(window.App = window.App || {});
