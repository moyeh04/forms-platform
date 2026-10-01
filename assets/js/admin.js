/** Admin dashboard core: login, navigation, shared widgets, and the forms list. */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast;
  var A = App.admin = { views: {} };
  var started = false;

  A.TYPES = {
    team_registration: { label: 'Team registration', icon: 'team', text: 'A team leader and members, a project title, and an optional Drive folder.' },
    task_submission: { label: 'Task submission', icon: 'task', text: 'A team, a task name, and a slides link. Teams are merged under one task.' },
    reservation: { label: 'Reservation', icon: 'calendar', text: 'Teams book a day and a time slot. One team per slot.' },
    whatsapp_registration: { label: 'WhatsApp group registration', icon: 'chat', text: 'Name, phone, group, section and timetable. Reviewed in two steps and matched to WhatsApp requests.' }
  };
  A.STATUS_LABEL = { draft: 'Draft', open: 'Open', closed: 'Closed', archived: 'Archived' };
  A.SUB_STATUSES = ['new', 'in_review', 'approved', 'rejected', 'done'];
  A.SUB_LABEL = { new: 'New', in_review: 'In review', approved: 'Approved', rejected: 'Rejected', done: 'Done', pending: 'Pending' };
  A.REVIEW = ['pending', 'approved', 'rejected'];

  /* ── Calls and errors ───────────────────────────────────────── */

  A.call = async function (action, extra) {
    try {
      return await App.api.admin(action, extra);
    } catch (e) {
      if (e.code === 'bad_pin' || e.code === 'locked') { App.api.setPin(''); A.start(); }
      throw e;
    }
  };

  A.fail = function (e) {
    var msg = (e && e.message) || 'Something went wrong.';
    if (e && e.code === 'invalid' && e.details) {
      msg += ' (' + Object.keys(e.details).join(', ') + ')';
    }
    toast(msg, 'err');
  };

  /** Runs a button action: disables it, reports errors, always re-enables. */
  A.busy = async function (btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { A.fail(e); } finally { if (btn) btn.disabled = false; }
  };

  A.formLink = function (slug) { return new URL('index.html?f=' + encodeURIComponent(slug), window.location.href).href; };
  A.viewerLink = function (token) { return new URL('viewer.html?t=' + encodeURIComponent(token), window.location.href).href; };

  /* ── Small widgets ──────────────────────────────────────────── */

  A.badge = function (text, kind) { return h('span', { class: 'badge ' + (kind || String(text).toLowerCase()) }, text); };

  A.field = function (label, control, help) {
    return h('label', { class: 'field-row' }, h('span', { class: 'label' }, label), control, help ? h('span', { class: 'help' }, help) : null);
  };

  A.check = function (label, checked, onchange, disabled) {
    return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!checked, disabled: !!disabled, onchange: function (e) { onchange(e.target.checked); } }), label);
  };

  A.text = function (value, onchange, attrs) {
    return h('input', Object.assign({ class: 'input', type: 'text', value: value == null ? '' : value, oninput: function (e) { onchange(e.target.value); } }, attrs || {}));
  };

  A.number = function (value, onchange, attrs) {
    return h('input', Object.assign({ class: 'input', type: 'number', inputmode: 'numeric', value: value == null ? '' : value, oninput: function (e) { onchange(e.target.value); } }, attrs || {}));
  };

  A.select = function (value, options, onchange) {
    return h('select', { class: 'select', onchange: function (e) { onchange(e.target.value); } },
      options.map(function (o) {
        var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
        return h('option', { value: v, selected: String(v) === String(value) }, l);
      }));
  };

  /* ── Term and subject ───────────────────────────────────────── */

  A.SEASONS = ['Fall', 'Spring', 'Summer'];

  /** "Fall 2027" -> { season: 'Fall', year: '2027' }; anything else is kept as custom text. */
  A.parseTerm = function (term) {
    var m = String(term || '').trim().match(/^(fall|spring|summer)\s+(\d{4})$/i);
    if (!m) return { season: '', year: '', custom: String(term || '').trim() };
    return { season: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), year: m[2], custom: '' };
  };

  /**
   * Season chips, a year list, and the subject code. o = { term, subject };
   * onchange receives { term, subject } on every change.
   */
  A.termPicker = function (o, onchange) {
    var st = A.parseTerm(o.term);
    var subject = o.subject || '';
    var now = new Date().getFullYear();
    if (!st.year) st.year = String(now);
    var years = [];
    for (var y = now - 1; y <= now + 4; y++) years.push(String(y));
    if (years.indexOf(st.year) === -1) years.unshift(st.year);

    function term() { return st.season ? st.season + ' ' + st.year : st.custom; }
    function emit() { onchange({ term: term(), subject: subject }); }

    var chips = h('div', { class: 'toggle-chips season-chips', role: 'radiogroup', 'aria-label': 'Term' });
    var custom = h('p', { class: 'muted-note' });
    function paint() {
      ui.clear(chips);
      A.SEASONS.forEach(function (s) {
        var on = st.season === s;
        chips.appendChild(h('button', { type: 'button', class: 'toggle-chip', role: 'radio', name: 'season-' + s.toLowerCase(), 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false', onclick: function () {
          st.season = on ? '' : s; st.custom = '';
          paint(); emit();
        } }, s));
      });
      custom.textContent = !st.season && st.custom ? 'Current term: "' + st.custom + '". Pick a season to replace it.' : '';
      yearSel.disabled = !st.season;
    }
    var yearSel = A.select(st.year, years, function (v) { st.year = v; emit(); });
    yearSel.name = 'termYear';
    yearSel.setAttribute('aria-label', 'Year');
    var subj = A.text(subject, function (v) { subject = v.replace(/\s+/g, ''); emit(); }, { name: 'subject', placeholder: 'CMPn323', dir: 'ltr', autocomplete: 'off', spellcheck: 'false' });
    paint();
    return h('div', { class: 'term-picker' },
      h('div', { class: 'field-row term-season' }, h('span', { class: 'label' }, 'Term'), chips, custom),
      h('label', { class: 'field-row term-year' }, h('span', { class: 'label' }, 'Year'), yearSel),
      h('label', { class: 'field-row term-subject' }, h('span', { class: 'label' }, 'Subject code'), subj, h('span', { class: 'help' }, 'Shown beside the title, for example CMPn323. No spaces.')));
  };

  /** Small tags for a form's subject code and term. */
  A.termTags = function (f) {
    return [f.subject ? h('span', { class: 'tag-sm tag-subject' }, f.subject) : null, f.term ? h('span', { class: 'tag-sm' }, f.term) : null];
  };

  A.modal = function (title, body, buttons) {
    var overlay;
    var close = function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    var actions = (buttons || [{ text: 'Close', kind: 'quiet' }]).map(function (b) {
      return h('button', { type: 'button', class: 'btn btn-' + (b.kind || 'quiet'), onclick: function (e) {
        if (!b.onclick) return close();
        A.busy(e.currentTarget, async function () { if ((await b.onclick(close)) !== false) close(); });
      } }, b.text);
    });
    overlay = h('div', { class: 'overlay', onclick: function (e) { if (e.target === overlay) close(); } },
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', { class: 'dialog-title' }, title), body, h('div', { class: 'dialog-actions' }, actions)));
    document.body.appendChild(overlay);
    return { close: close, el: overlay };
  };

  /** Shows a one-time link or key with a copy button. */
  A.reveal = function (title, note, value, big) {
    var body = h('div', null,
      h('p', null, note),
      big ? h('div', { class: 'key-reveal' }, value) : h('div', { class: 'link-box' }, h('code', null, value)));
    return A.modal(title, body, [
      { text: 'Copy', kind: 'primary', onclick: async function () { toast((await ui.copyText(value)) ? 'Copied' : 'Could not copy', 'ok'); return false; } },
      { text: 'Done', kind: 'quiet' }
    ]);
  };

  A.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toISOString().slice(0, 10);
  };

  /* ── Shell and routing ──────────────────────────────────────── */

  function route() {
    var parts = (window.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { name: 'forms', args: [] };
    if (parts[0] === 'new') return { name: 'create', args: [] };
    if (parts[0] === 'clients') return { name: 'clients', args: [] };
    if (parts[0] === 'lists') return { name: 'lists', args: [] };
    if (parts[0] === 'f' && parts[1]) return { name: parts[2] === 'settings' ? 'settings' : 'responses', args: [parts[1]] };
    return { name: 'forms', args: [] };
  }

  function navLink(href, text, active) {
    return h('a', { href: href, 'aria-current': active ? 'page' : null }, text);
  }

  async function render() {
    var root = document.getElementById('app');
    ui.clear(root);
    if (!App.api.getPin()) return loginView(root);
    var r = route();
    var mount = h('main', { id: 'main' }, h('div', { class: 'loading' }, 'Loading...'));
    var group = r.name === 'responses' || r.name === 'settings' || r.name === 'create' ? 'forms' : r.name;
    root.appendChild(h('div', { class: 'admin-page' },
      h('header', { class: 'admin-bar' },
        h('h1', null, 'Forms dashboard'),
        h('nav', { class: 'admin-nav', 'aria-label': 'Sections' },
          navLink('#/', 'Forms', group === 'forms'), navLink('#/clients', 'Clients', group === 'clients'), navLink('#/lists', 'Lists', group === 'lists')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Switch light and dark', onclick: function () { App.theme.toggle(); render(); } }, icon(App.theme.effective() === 'dark' ? 'sun' : 'moon', 20)),
        h('button', { type: 'button', class: 'icon-btn', onclick: function () { App.api.setPin(''); render(); } }, icon('logout', 20), 'Log out')),
      mount));
    var view = A.views[r.name];
    try { await view.apply(null, [mount].concat(r.args)); } catch (e) {
      ui.clear(mount);
      mount.appendChild(h('div', { class: 'banner' }, e.message || 'Could not load this page.'));
      if (e.code === 'bad_pin' || e.code === 'locked') { App.api.setPin(''); render(); }
    }
  }

  A.start = function () {
    if (!started) { started = true; window.addEventListener('hashchange', render); }
    return render();
  };
  A.render = render;

  /* ── Login ──────────────────────────────────────────────────── */

  function loginView(root) {
    var pin = h('input', { class: 'input pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', id: 'pin', name: 'pin', 'aria-describedby': 'pin-err' });
    var err = h('p', { class: 'error', id: 'pin-err', role: 'alert', hidden: true });
    var btn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Open dashboard');
    var form = h('form', { novalidate: 'novalidate', onsubmit: async function (e) {
      e.preventDefault();
      err.hidden = true;
      btn.disabled = true;
      try {
        await App.api.call({ action: 'admin.login', admin: { pin: pin.value } });
        App.api.setPin(pin.value);
        render();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
        pin.value = '';
        pin.focus();
      } finally { btn.disabled = false; }
    } },
      h('h1', { class: 'step-title' }, 'Admin dashboard'),
      h('p', { class: 'help' }, 'Enter the admin PIN you set from the Forms Platform menu in the registry sheet.'),
      h('label', { class: 'field', for: 'pin' }, h('span', { class: 'label' }, 'Admin PIN')),
      pin, err, h('div', { class: 'nav' }, btn));
    root.appendChild(h('div', { class: 'login' }, h('div', { class: 'sheet' }, h('div', { class: 'wrap' }, form))));
    pin.focus();
  }

  /* ── Forms list ─────────────────────────────────────────────── */

  A.views.forms = async function (mount) {
    var res = await A.call('admin.forms.list');
    var forms = res.forms.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Forms'),
      h('a', { class: 'btn btn-primary', href: '#/new' }, icon('plus', 20), 'New form')));
    if (!forms.length) {
      mount.appendChild(h('div', { class: 'empty' }, 'No forms yet. Create the first one and choose what it collects.'));
      return;
    }
    mount.appendChild(h('div', { class: 'cards' }, forms.map(formCard)));
  };

  function formCard(f) {
    var t = A.TYPES[f.type] || { label: f.type, icon: 'task' };
    var link = A.formLink(f.slug);
    return h('article', { class: 'card', dataset: { slug: f.slug } },
      h('div', { class: 'card-top' }, icon(t.icon, 24),
        h('div', null, h('h3', null, f.title), A.termTags(f))),
      h('div', { class: 'actions' }, A.badge(A.STATUS_LABEL[f.status] || f.status, f.status), h('span', { class: 'muted-note' }, t.label)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary sm', href: '#/f/' + encodeURIComponent(f.slug) }, 'Responses'),
        h('a', { class: 'btn btn-quiet sm', href: '#/f/' + encodeURIComponent(f.slug) + '/settings' }, 'Settings'),
        h('a', { class: 'btn btn-quiet sm', href: link, target: '_blank', rel: 'noopener' }, 'Open form'),
        h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(link)) ? 'Form link copied' : 'Could not copy', 'ok'); } }, icon('link', 18), 'Copy link'),
        f.sheetUrl ? h('a', { class: 'btn btn-quiet sm', href: f.sheetUrl, target: '_blank', rel: 'noopener' }, 'Google Sheet') : null,
        h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function () { duplicateDialog(f); } }, 'Duplicate')));
  }

  function duplicateDialog(f) {
    var title = f.title, term = f.term, subject = f.subject || '';
    var body = h('div', null,
      h('p', { class: 'help' }, 'The copy keeps every setting, starts as a draft, and gets its own empty Google Sheet.'),
      A.field('Title', A.text(title, function (v) { title = v; })),
      A.termPicker({ term: term, subject: subject }, function (v) { term = v.term; subject = v.subject; }));
    A.modal('Duplicate "' + f.title + '"', body, [
      { text: 'Cancel', kind: 'quiet' },
      { text: 'Make a copy', kind: 'primary', onclick: async function () {
        var res = await A.call('admin.forms.duplicate', { id: f.id, title: title, term: term, subject: subject });
        toast('Copy created as a draft', 'ok');
        window.location.hash = '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
      } }
    ]);
  }

  /* ── Create ─────────────────────────────────────────────────── */

  A.views.create = async function (mount) {
    var state = { type: 'team_registration', title: '', term: A.SEASONS[0] + ' ' + new Date().getFullYear(), subject: '' };
    ui.clear(mount);
    var picks = Object.keys(A.TYPES).map(function (k) {
      var t = A.TYPES[k];
      return h('label', { class: 'type-opt' },
        h('input', { type: 'radio', name: 'type', value: k, checked: k === state.type, onchange: function () { state.type = k; } }),
        h('div', null, h('strong', null, icon(t.icon, 22), t.label), h('p', null, t.text)));
    });
    var btn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Create form');
    mount.appendChild(h('form', { novalidate: 'novalidate', onsubmit: function (e) {
      e.preventDefault();
      if (!state.title.trim()) return toast('Give the form a title first.', 'err');
      A.busy(btn, async function () {
        var res = await A.call('admin.forms.create', { type: state.type, title: state.title, term: state.term, subject: state.subject });
        toast('Form created as a draft. Check its settings, then open it.', 'ok');
        window.location.hash = '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
      });
    } },
      h('div', { class: 'page-head' }, h('h2', null, 'New form')),
      h('div', { class: 'panel' }, h('h2', null, 'What does it collect?'), h('div', { class: 'type-pick' }, picks)),
      h('div', { class: 'panel' }, h('h2', null, 'Name it'),
        A.field('Title', A.text('', function (v) { state.title = v; }, { name: 'title', placeholder: 'Database Team Project Registration Form' }), 'This is the heading students see.'),
        A.termPicker({ term: state.term, subject: state.subject }, function (v) { state.term = v.term; state.subject = v.subject; })),
      h('div', { class: 'actions' }, btn, h('a', { class: 'btn btn-quiet', href: '#/' }, 'Cancel'))));
  };
})(window.App = window.App || {});
