/**
 * The page behind a private instructor or client link.
 * Read-only: no PIN, no Google account. The admin chooses the forms and the
 * columns that appear here, and can turn the link off at any time.
 */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast;
  var V = App.viewer = {};
  var S = { token: '', slug: '', me: null, data: null, mode: 'auto', dayId: '', q: '', error: '' };

  function bdi(text) { return h('bdi', { lang: 'ar' }, text || ''); }

  function params() {
    var u = new URLSearchParams(window.location.search);
    return { t: u.get('t') || '', f: u.get('f') || '' };
  }

  async function load() {
    S.data = await App.api.viewer('viewer.data', S.token, { slug: S.slug, mode: S.mode === 'auto' ? 'all' : S.mode, dayId: S.dayId });
    var d = S.data;
    if (S.mode === 'auto') {
      S.mode = d.kind === 'reservation' && (d.days || []).some(function (x) { return x.date && x.date === d.today; }) ? 'today' : 'all';
      if (S.mode === 'today') S.data = await App.api.viewer('viewer.data', S.token, { slug: S.slug, mode: 'today' });
    }
  }

  V.start = async function () {
    var p = params();
    S.token = p.t;
    S.slug = p.f;
    if (!S.token) { S.error = 'This link is missing its access code. Ask for a new one.'; return render(); }
    try {
      S.me = await App.api.viewer('viewer.me', S.token);
      var known = S.me.forms.some(function (f) { return f.slug === S.slug; });
      if (!known) S.slug = S.me.forms[0] ? S.me.forms[0].slug : '';
      if (S.slug) await load();
    } catch (e) {
      S.error = e.message;
    }
    render();
  };

  async function reload(msg) {
    try { await load(); if (msg) toast(msg, 'ok'); } catch (e) { toast(e.message, 'err'); }
    render();
  }

  /* ── Rendering ──────────────────────────────────────────────── */

  function render() {
    var root = document.getElementById('app');
    ui.clear(root);
    if (S.error) {
      return root.appendChild(h('div', { class: 'login' }, h('div', { class: 'sheet' }, h('div', { class: 'wrap' },
        h('h1', { class: 'step-title' }, 'This link cannot be opened'), h('p', null, S.error)))));
    }
    var d = S.data;
    var bar = h('header', { class: 'admin-bar' },
      h('h1', null, d ? d.form.title : 'Registrations'),
      d && d.form.subject ? h('span', { class: 'tag-sm tag-subject' }, d.form.subject) : null,
      d && d.form.term ? h('span', { class: 'tag-sm' }, d.form.term) : null,
      h('span', { class: 'muted-note' }, 'Viewing as ' + S.me.client.name),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Switch light and dark', onclick: function () { App.theme.toggle(); render(); } }, icon(App.theme.effective() === 'dark' ? 'sun' : 'moon', 20)));
    var page = h('div', { class: 'admin-page' }, bar);
    root.appendChild(page);
    if (!d) return page.appendChild(h('div', { class: 'empty' }, 'No forms have been shared with you yet.'));

    var tools = [];
    if (S.me.forms.length > 1) {
      var sel = A_select(S.slug, S.me.forms.map(function (f) { return [f.slug, f.title + (f.term ? ' (' + f.term + ')' : '')]; }), function (v) {
        S.slug = v; S.mode = 'auto'; S.dayId = ''; S.q = '';
        reload();
      });
      sel.setAttribute('aria-label', 'Form');
      tools.push(sel);
    }
    if (d.kind === 'reservation') tools.push.apply(tools, reservationTools(d));
    var search = h('input', { class: 'input', type: 'search', name: 'search', placeholder: 'Search', 'aria-label': 'Search', value: S.q, oninput: function (e) { S.q = e.target.value; paintBody(); } });
    tools.push(search,
      h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'refresh', onclick: function () { reload('Updated'); } }, icon('refresh', 18), 'Refresh'),
      h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'print', onclick: function () { window.print(); } }, icon('printer', 18), 'Print or save as PDF'));
    page.appendChild(h('div', { class: 'toolbar' }, tools));
    var body = h('div', { id: 'body' });
    page.appendChild(body);
    paintBody();
  }

  function A_select(value, options, onchange) {
    return h('select', { class: 'select', onchange: function (e) { onchange(e.target.value); } },
      options.map(function (o) { return h('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]); }));
  }

  function reservationTools(d) {
    var hasToday = (d.days || []).some(function (x) { return x.date; });
    var modes = [];
    if (hasToday) modes.push(['today', 'Today']);
    modes.push(['day', 'By day'], ['all', 'All']);
    var out = modes.map(function (m) {
      return h('button', { type: 'button', class: 'btn sm ' + (S.mode === m[0] ? 'btn-primary' : 'btn-quiet'), dataset: { mode: m[0] }, 'aria-pressed': S.mode === m[0] ? 'true' : 'false', onclick: function () {
        S.mode = m[0];
        if (m[0] === 'day' && !S.dayId && d.days[0]) S.dayId = d.days[0].id;
        reload();
      } }, m[1]);
    });
    if (S.mode === 'day') {
      var sel = A_select(S.dayId, d.days.map(function (x) { return [x.id, x.label]; }), function (v) { S.dayId = v; reload(); });
      sel.setAttribute('aria-label', 'Day');
      out.push(sel);
    }
    return out;
  }

  function matches(obj) {
    var q = S.q.trim().toLowerCase();
    return !q || JSON.stringify(obj).toLowerCase().indexOf(q) !== -1;
  }

  function paintBody() {
    var body = document.getElementById('body');
    if (!body) return;
    ui.clear(body);
    var d = S.data;
    var node = d.kind === 'reservation' ? reservations(d) : d.kind === 'team' ? teams(d) : registrations(d);
    body.appendChild(node);
  }

  function colIds(d) { return d.columns.map(function (c) { return c.id; }); }

  function cell(col, row) {
    var v = row[col];
    if (col === 'name') return h('td', { class: 'nm' }, bdi(v));
    if (col === 'code' || col === 'phone' || col === 'time') return h('td', { class: 'mono' }, v);
    if (col === 'link') return h('td', null, v ? h('a', { href: v, target: '_blank', rel: 'noopener' }, 'Open') : '');
    return h('td', null, v === undefined ? '' : String(v));
  }

  function reservations(d) {
    var rows = d.rows.filter(matches);
    if (!rows.length) return h('div', { class: 'empty' }, S.mode === 'today' ? 'No bookings for today.' : 'No bookings to show.');
    var groups = [];
    rows.forEach(function (r) {
      var g = groups.filter(function (x) { return x.id === r.dayId; })[0];
      if (!g) { g = { id: r.dayId, label: r.dayLabel, date: r.date, rows: [] }; groups.push(g); }
      g.rows.push(r);
    });
    var cols = d.columns;
    return h('div', null, groups.map(function (g, i) {
      return h('section', { class: 'block single ' + (i % 2 ? 'tint-b' : 'tint-a'), dataset: { day: g.id } },
        h('div', { class: 'day-head' }, h('span', null, g.label + (g.date ? ' (' + g.date + ')' : '')), h('span', null, g.rows.length + ' booked')),
        h('div', { class: 'scroll-x' }, h('table', { class: 'mini' },
          h('thead', null, h('tr', null, cols.map(function (c) { return h('th', null, c.label); }))),
          h('tbody', null, g.rows.map(function (r) { return h('tr', null, cols.map(function (c) { return cell(c.id, r); })); })))));
    }));
  }

  function teams(d) {
    var groups = d.groups.filter(matches);
    if (!groups.length) return h('div', { class: 'empty' }, 'No teams to show.');
    var ids = colIds(d);
    var showName = ids.indexOf('name') !== -1, showCode = ids.indexOf('code') !== -1, showPhone = ids.indexOf('phone') !== -1;
    var third = d.form.type === 'task_submission' ? 'Task' : 'Project';
    return h('div', { class: 'team-list' }, groups.map(function (g, i) {
      var hasTitle = g.title !== undefined || g.link !== undefined;
      var head = [h('th', null, '#'), showName ? h('th', null, 'Team member') : null, showCode ? h('th', null, 'Code') : null, showPhone ? h('th', null, 'Phone') : null];
      return h('article', { class: 'block team-card ' + (i % 2 ? 'tint-b' : 'tint-a'), dataset: { ref: g.ref } },
        h('header', { class: 'block-head' },
          h('span', { class: 'team-no' }, 'Team ' + (i + 1)),
          hasTitle ? h('div', { class: 'block-side block-title' }, h('span', { class: 'kicker' }, third),
            g.link ? h('a', { href: g.link, target: '_blank', rel: 'noopener' }, g.title || 'Open', icon('link', 15)) : h('span', null, g.title || '-')) : h('div', { class: 'block-title' }),
          h('span', { class: 'block-meta' }, g.members.length === 1 ? 'Solo' : g.members.length + ' members')),
        h('div', { class: 'scroll-x' }, h('table', { class: 'mini' },
          h('thead', null, h('tr', null, head)),
          h('tbody', null, g.members.map(function (m, k) {
            return h('tr', { class: m.leader ? 'leader' : null },
              h('td', { class: 'num' }, String(k + 1)),
              showName ? h('td', { class: 'nm' }, bdi(m.name), m.leader ? h('span', { class: 'lead-tag' }, icon('star', 13), 'Leader') : null) : null,
              showCode ? h('td', { class: 'mono' }, m.code) : null, showPhone ? h('td', { class: 'mono' }, m.phone) : null);
          })))));
    }));
  }

  function registrations(d) {
    var rows = d.rows.filter(matches);
    if (!rows.length) return h('div', { class: 'empty' }, 'No registrations to show.');
    var cols = d.columns;
    return h('div', { class: 'scroll-x' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, cols.map(function (c) { return h('th', null, c.label); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', { dataset: { id: r.id } }, cols.map(function (c) { return c.id === 'review' ? reviewCell(d, r) : cell(c.id, r); }));
      }))));
  }

  function reviewCell(d, r) {
    return h('td', null, h('div', { class: 'actions' }, d.steps.map(function (st) {
      var cur = (r.review || {})[st.id] || 'pending';
      if (!d.canReview) return h('span', null, st.label.en + ': ', h('span', { class: 'badge ' + cur }, cur));
      var sel = A_select(cur, ['pending', 'approved', 'rejected'].map(function (x) { return [x, x[0].toUpperCase() + x.slice(1)]; }), function (v) {
        App.api.viewer('viewer.review', S.token, { slug: S.slug, submissionId: r.id, stepId: st.id, status: v })
          .then(function () { r.review[st.id] = v; toast(st.label.en + ': ' + v, 'ok'); })
          .catch(function (e) { toast(e.message, 'err'); });
      });
      sel.setAttribute('aria-label', st.label.en);
      return h('label', null, h('span', { class: 'muted-note' }, st.label.en + ' '), sel);
    })));
  }
})(window.App = window.App || {});
