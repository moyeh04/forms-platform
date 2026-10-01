/** The success ticket: reference, key with a callout, expiry, and ways to keep it. */
(function (App) {
  'use strict';
  var h = App.ui.h;
  var t = function (k, p) { return App.i18n.t(k, p); };

  function arrowCallout() {
    var svg = '<svg viewBox="0 0 44 60" width="40" height="54" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 3c7 11-6 23 0 40"/><path d="M11 35l11 12 11-12"/></svg>';
    var s = h('span', { class: 'callout-arrow' });
    s.innerHTML = svg;
    return s;
  }

  function digits(key) {
    return h('div', { class: 'key-digits', role: 'text', 'aria-label': key.split('').join(' ') },
      key.split('').map(function (d) { return h('span', { class: 'key-digit code' }, d); }));
  }

  /** summary: [{ label, value }] rows shown under the key. */
  function render(o) {
    var kids = [
      h('h2', { class: 'ticket-title' }, t(o.edited ? 'savedTitle' : 'ticketTitle')),
      h('p', { class: 'ticket-ref' }, h('span', { class: 'muted' }, t('ticketRef') + '  '), h('span', { class: 'code' }, o.ref))
    ];
    if (o.key) {
      kids.push(
        h('div', { class: 'key-block' },
          h('div', { class: 'key-note' }, h('span', { class: 'key-note-text' }, t('ticketKeyNote')), arrowCallout()),
          h('p', { class: 'key-label' }, t('ticketKey')),
          digits(o.key),
          h('p', { class: 'help' }, t('ticketValid', { date: App.i18n.fmtDate(o.keyExpires) }))
        ),
        h('p', { class: 'shot-note' }, t('ticketShot'))
      );
    } else if (!o.edited) {
      kids.push(h('p', null, t('ticketNoKey')));
    }
    if (o.email) kids.push(h('p', { class: 'help' }, t('emailSent', { email: o.email })));
    if (o.summary && o.summary.length) {
      kids.push(h('dl', { class: 'summary' }, o.summary.map(function (r) {
        return [h('dt', null, r.label), h('dd', null, r.value)];
      })));
    }
    return h('section', { class: 'ticket', id: 'ticket' }, kids);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function saveImage(node, name) {
    if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    var cs = getComputedStyle(document.body);
    var canvas = await window.html2canvas(node, { backgroundColor: cs.backgroundColor, scale: 2, useCORS: true });
    var a = document.createElement('a');
    a.download = (name || 'registration') + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Buttons under the ticket. */
  function actions(o) {
    var copyBtn = o.key ? h('button', { type: 'button', class: 'btn btn-quiet', onclick: async function (e) {
      var ok = await App.ui.copyText(o.key);
      if (ok) App.ui.toast(t('copied'), 'ok');
    } }, App.ui.icon('copy', 20), t('copyKey')) : null;
    return h('div', { class: 'ticket-actions' },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: async function () {
        try { await saveImage(document.getElementById('ticket'), o.ref); } catch (e) { App.ui.toast(t('imageFail'), 'err'); }
      } }, App.ui.icon('download', 20), t('saveImage')),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { window.print(); } }, App.ui.icon('printer', 20), t('savePdf')),
      copyBtn
    );
  }

  App.ticket = { render: render, actions: actions, saveImage: saveImage };
})(window.App = window.App || {});
