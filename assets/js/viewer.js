/**
 * The page behind a private instructor or client link.
 * Read-only: no PIN, no Google account. The admin chooses the forms and the
 * columns that appear here, and can turn the link off at any time.
 */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast;
  var V = App.viewer = {};
  var S = { token: '', slug: '', me: null, data: null, mode: 'auto', dayId: '', q: '', error: '', key: '', askKey: false, keyError: '' };

  /** The access key is kept for this tab only, under the link it opens. */
  var KEY_STORE = 'fp_viewer_key_';
  function storedKey() { try { return window.sessionStorage.getItem(KEY_STORE + S.token) || ''; } catch (e) { return ''; } }
  function storeKey(k) { try { if (k) window.sessionStorage.setItem(KEY_STORE + S.token, k); else window.sessionStorage.removeItem(KEY_STORE + S.token); } catch (e) { /* storage off */ } }
  /** Every call carries the key; the server asks for it only when the link has one. */
  function call(action, extra) { return App.api.viewer(action, S.token, Object.assign({ accessKey: S.key || undefined }, extra || {})); }
  var KEY_ERRORS = ['key_needed', 'bad_access_key', 'key_locked'];

  function bdi(text) { return h('bdi', { lang: 'ar' }, text || ''); }

  function params() {
    var u = new URLSearchParams(window.location.search);
    return { t: u.get('t') || '', f: u.get('f') || '' };
  }

  async function load() {
    S.data = await call('viewer.data', { slug: S.slug, mode: S.mode === 'auto' ? 'all' : S.mode, dayId: S.dayId });
    var d = S.data;
    if (S.mode === 'auto') {
      S.mode = d.kind === 'reservation' && (d.days || []).some(function (x) { return x.date && x.date === d.today; }) ? 'today' : 'all';
      if (S.mode === 'today') S.data = await call('viewer.data', { slug: S.slug, mode: 'today' });
    }
  }

  V.start = async function () {
    var p = params();
    S.token = p.t;
    S.slug = p.f;
    if (!S.token) { S.error = 'This link is missing its access code. Ask for a new one.'; return render(); }
    S.key = storedKey();
    await open();
  };

  async function open() {
    try {
      S.me = await call('viewer.me');
      S.askKey = false; S.keyError = '';
      storeKey(S.key);
      var known = S.me.forms.some(function (f) { return f.slug === S.slug; });
      if (!known) S.slug = S.me.forms[0] ? S.me.forms[0].slug : '';
      if (S.slug) await load();
    } catch (e) {
      if (KEY_ERRORS.indexOf(e.code) !== -1) {
        // A stored key that stopped working (a new key was made) is forgotten.
        storeKey('');
        S.askKey = true;
        S.keyError = e.code === 'key_needed' ? '' : e.message;
      } else S.error = e.message;
    }
    render();
  }

  /** The link has a key: ask for it, and keep a wrong one in its field with the reason. */
  function keyView() {
    var input = h('input', { class: 'input key-input', id: 'access-key', type: 'text', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code', placeholder: '000000', 'aria-label': 'Access key', 'aria-describedby': 'access-key-err', value: S.key });
    var busy = false;
    return h('div', { class: 'login' }, loginTop(), h('div', { class: 'sheet' }, h('div', { class: 'wrap' },
      h('h1', { class: 'step-title' }, 'Enter the access key'),
      h('p', null, 'This is a private page for an instructor: the teams, bookings or registrations of the forms shared with you. It also needs the six-digit key that was sent to you separately.'),
      h('form', { novalidate: 'novalidate', onsubmit: async function (e) {
        e.preventDefault();
        if (busy) return;
        S.key = input.value.replace(/\D/g, '');
        if (S.key.length !== 6) { S.keyError = 'The key has six digits.'; return render(); }
        busy = true;
        await open();
      } },
        input,
        h('p', { class: 'error', id: 'access-key-err', role: 'alert' }, S.keyError || ''),
        h('div', { class: 'nav' }, h('button', { type: 'submit', class: 'btn btn-primary', name: 'open-view' }, 'Open'))))));
  }

  /** What the page is and the theme switch, on the screens shown before a link opens. */
  function loginTop() {
    return h('div', { class: 'login-top' }, h('span', { class: 'tool-label' }, 'Instructor view'), ui.themeButton());
  }

  async function reload(msg) {
    try { await load(); if (msg) toast(msg, 'ok'); } catch (e) { toast(e.message, 'err'); }
    render();
  }

  /* ── Rendering ──────────────────────────────────────────────── */

  function render() {
    var root = document.getElementById('app');
    ui.clear(root);
    if (S.error) {
      return root.appendChild(h('div', { class: 'login' }, loginTop(), h('div', { class: 'sheet' }, h('div', { class: 'wrap' },
        h('h1', { class: 'step-title' }, 'This link cannot be opened'), h('p', null, S.error)))));
    }
    if (S.askKey) { root.appendChild(keyView()); var el = document.getElementById('access-key'); if (el) el.focus(); return; }
    var d = S.data;
    var bar = h('header', { class: 'admin-bar' },
      h('h1', null, d ? d.form.title : 'Registrations'),
      d && FormMetadata.display(d.form).map(function (item) { return h('span', { class: 'tag-sm' + (item.variant === 'subject' ? ' tag-subject' : '') }, item.value); }),
      h('span', { class: 'muted-note' }, 'Viewing as ' + S.me.client.name),
      ui.themeButton());
    var page = h('div', { class: 'admin-page' }, bar);
    root.appendChild(page);
    if (!d) return page.appendChild(h('div', { class: 'empty' }, 'No forms have been shared with you yet.'));

    var tools = [];
    if (S.me.forms.length > 1) {
      var sel = A_select(S.slug, S.me.forms.map(function (f) { var caption = FormMetadata.caption(f); return [f.slug, f.title + (caption ? ' (' + caption + ')' : '')]; }), function (v) {
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
    if (col === 'members') return h('td', null, v || '');
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
          h('tbody', null, g.rows.map(function (r) { return h('tr', null, cols.map(function (c) { var td = cell(c.id, r); td.dataset.label = c.label; return td; })); })))));
    }));
  }

  function teams(d) {
    var groups = d.groups.filter(matches);
    if (!groups.length) return h('div', { class: 'empty' }, 'No teams to show.');
    var ids = colIds(d);
    var showName = ids.indexOf('name') !== -1, showSection = ids.indexOf('section') !== -1, showCode = ids.indexOf('code') !== -1, showPhone = ids.indexOf('phone') !== -1;
    var third = d.form.type === 'task_submission' ? 'Task' : 'Project';
    return h('div', { class: 'team-list' }, groups.map(function (g, i) {
      var hasTitle = g.title !== undefined || g.link !== undefined;
      var head = [h('th', null, '#'), showName ? h('th', null, 'Team member') : null, showSection ? h('th', null, 'Section') : null, showCode ? h('th', null, 'Code') : null, showPhone ? h('th', null, 'Phone') : null];
      return h('article', { class: 'block team-card ' + (i % 2 ? 'tint-b' : 'tint-a'), dataset: { ref: g.ref } },
        h('header', { class: 'block-head' },
          h('span', { class: 'team-no' }, 'Team ' + g.number),
          hasTitle ? h('div', { class: 'block-side block-title' }, h('span', { class: 'kicker' }, third),
            g.link ? h('a', { href: g.link, target: '_blank', rel: 'noopener' }, g.title || 'Open', icon('link', 15)) : h('span', null, g.title || '-')) : h('div', { class: 'block-title' }),
          h('span', { class: 'block-meta' }, g.members.length === 1 ? 'Solo' : g.members.length + ' members')),
        h('div', { class: 'scroll-x' }, h('table', { class: 'mini' },
          h('thead', null, h('tr', null, head)),
          h('tbody', null, g.members.map(function (m, k) {
            return h('tr', { class: m.leader ? 'leader' : null },
              h('td', { class: 'num' }, String(k + 1)),
              showName ? h('td', { class: 'nm' }, bdi(m.name), m.leader ? h('span', { class: 'lead-tag' }, icon('star', 13), 'Leader') : null) : null,
              showSection ? h('td', { dataset: { label: 'Section' } }, m.section || '-') : null,
              showCode ? h('td', { class: 'mono', dataset: { label: 'Code' } }, m.code) : null,
              showPhone ? h('td', { class: 'mono tel', dataset: { label: 'Phone' } }, m.phone ? h('a', { href: 'tel:' + m.phone }, m.phone) : '-') : null);
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
        call('viewer.review', { slug: S.slug, submissionId: r.id, stepId: st.id, status: v })
          .then(function () { r.review[st.id] = v; toast(st.label.en + ': ' + v, 'ok'); })
          .catch(function (e) { toast(e.message, 'err'); });
      });
      sel.setAttribute('aria-label', st.label.en);
      return h('label', null, h('span', { class: 'muted-note' }, st.label.en + ' '), sel);
    })));
  }
})(window.App = window.App || {});
