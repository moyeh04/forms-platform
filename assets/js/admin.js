/** Admin dashboard core: login, navigation, shared widgets, and the forms list. */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast;
  var A = App.admin = { views: {} };
  var started = false;

  // What each kind of form is: `text` says what it is for, `pages` are the pages students go
  // through (the same as the template in Templates.gs), `next` is what to set up after creating it.
  A.TYPES = {
    team_registration: { label: 'Team registration', icon: 'team', text: 'Teams sign up once: a leader, the members and a project title.',
      pages: ['About you', 'Study details', 'Team members', 'Project'], next: ['Set the smallest and the largest team.', 'Choose who can register.'] },
    task_submission: { label: 'Task submission', icon: 'task', text: 'Teams hand in a task with a link to their work.',
      pages: ['About you', 'Study details', 'Team members', 'Task'], next: ['Set the team size.', 'Check the rule for the links students send.'] },
    reservation: { label: 'Reservation', icon: 'calendar', text: 'Teams book one time slot on a day that you offer.',
      pages: ['About you', 'Study details', 'Project', 'Time slot'], next: ['Add the days and times in the Timetable tab.', 'Choose how many bookings one slot takes.'] },
    whatsapp_registration: { label: 'WhatsApp group registration', icon: 'chat', text: 'Students ask to join a group, and you check each one against the join requests.',
      pages: ['About you', 'Study details', 'Schedule'], next: ['Paste the join requests under Responses to match them.'] }
  };
  A.STATUS_LABEL = { draft: 'Draft', open: 'Open', closed: 'Closed', archived: 'Archived' };
  // The order of the forms list: what students can reach now comes first.
  A.STATUSES = ['open', 'draft', 'closed', 'archived'];
  A.SUB_STATUSES = ['new', 'in_review', 'approved', 'rejected', 'done'];
  A.SUB_LABEL = { new: 'New', in_review: 'In review', approved: 'Approved', rejected: 'Rejected', done: 'Done', pending: 'Pending' };
  A.REVIEW = ['pending', 'approved', 'rejected'];

  /* ── Calls and errors ───────────────────────────────────────── */

  A.call = async function (action, extra) {
    try {
      return await App.api.admin(action, extra);
    } catch (e) {
      // A wrong PIN signs this window out. A lock is passing: the PIN is kept and the message says to wait.
      if (e.code === 'bad_pin') { App.api.setPin(''); A.start(); }
      throw e;
    }
  };

  /** What to tell the admin about a failed call. */
  A.message = function (e) {
    var msg = (e && e.message) || 'Something went wrong.';
    if (e && e.code === 'invalid' && e.details) {
      msg += ' (' + Object.keys(e.details).join(', ') + ')';
    }
    return msg;
  };

  A.fail = function (e) { toast(A.message(e), 'err'); };

  /** Runs a button action: disables it, reports errors, always re-enables. */
  A.busy = async function (btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { A.fail(e); } finally { if (btn) btn.disabled = false; }
  };

  A.formLink = function (slug) { return new URL('index.html?f=' + encodeURIComponent(slug), window.location.href).href; };
  A.viewerLink = function (token) { return new URL('viewer.html?t=' + encodeURIComponent(token), window.location.href).href; };

  /* ── Small widgets ──────────────────────────────────────────── */

  A.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  A.badge = function (text, kind) { return h('span', { class: 'badge ' + (kind || String(text).toLowerCase()) }, text); };

  A.field = function (label, control, help) {
    return h('label', { class: 'field-row' }, h('span', { class: 'label' }, label), control, help ? h('span', { class: 'help' }, help) : null);
  };

  A.check = function (label, checked, onchange, disabled, name) {
    return h('label', { class: 'check' }, h('input', { type: 'checkbox', name: name || null, checked: !!checked, disabled: !!disabled, onchange: function (e) { onchange(e.target.checked); } }), label);
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

  /* ── Form metadata adapters ─────────────────────────────────── */

  A.SEASONS = ['Fall', 'Spring', 'Summer'];
  A.METADATA_EDITORS = {};

  A.parseTerm = function (term) {
    var m = String(term || '').trim().match(/^(fall|spring|summer)\s+(\d{4}(?:\/\d{4})?)$/i);
    if (!m) return { season: '', year: '', custom: String(term || '').trim() };
    var year = m[2].indexOf('/') === -1 ? m[2] + '/' + (parseInt(m[2], 10) + 1) : m[2];
    return { season: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), year: year, custom: '' };
  };

  function yearOptions(current) { return FormMetadata.academicYears(current); }

  A.METADATA_EDITORS['term-subject'] = function (o, onchange) {
    var st = A.parseTerm(o.term), subject = o.subject || '';
    if (!st.year) st.year = yearOptions()[0];
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
    var yearSel = A.select(st.year, yearOptions(st.year), function (v) { st.year = v; emit(); });
    yearSel.name = 'termYear';
    yearSel.setAttribute('aria-label', 'Year');
    var subj = A.text(subject, function (v) { subject = v.replace(/\s+/g, ''); emit(); }, { name: 'subject', placeholder: 'CS101', dir: 'ltr', autocomplete: 'off', spellcheck: 'false' });
    paint();
    return h('div', { class: 'term-picker' },
      h('div', { class: 'field-row term-season' }, h('span', { class: 'label' }, 'Term'), chips, custom),
      h('label', { class: 'field-row term-year' }, h('span', { class: 'label' }, 'Year'), yearSel),
      h('label', { class: 'field-row term-subject' }, h('span', { class: 'label' }, 'Subject code'), subj, h('span', { class: 'help' }, 'Optional. A short code shown beside the title. No spaces.')));
  };

  A.METADATA_EDITORS['batch-year'] = function (o, onchange) {
    var select = A.select(o.batchYear || yearOptions()[0], yearOptions(o.batchYear), function (v) { onchange({ batchYear: v }); });
    select.name = 'batchYear';
    select.setAttribute('aria-label', 'Batch year');
    return h('div', { class: 'metadata-picker batch-year-picker' }, A.field('Batch year', select));
  };

  A.metadataEditor = function (type, values, onchange) {
    var adapter = FormMetadata.forType(type);
    var editor = A.METADATA_EDITORS[adapter.editor];
    return editor(values, onchange);
  };

  A.termTags = function (f) {
    return FormMetadata.display(f).map(function (item) {
      return h('span', { class: 'tag-sm' + (item.variant === 'subject' ? ' tag-subject' : '') }, item.value);
    });
  };

  A.modal = function (title, body, buttons) {
    var overlay;
    // Escape closes the dialog on top, like Cancel.
    var onKey = function (e) {
      var all = document.querySelectorAll('.overlay');
      if (e.key === 'Escape' && all[all.length - 1] === overlay) { e.stopImmediatePropagation(); close(); }
    };
    var close = function () {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
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
    document.addEventListener('keydown', onKey);
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

  /* ── The tabs of one form ───────────────────────────────────── */

  A.FORM_TABS = ['responses', 'questions', 'timetable', 'settings'];
  var TAB_LABEL = { responses: 'Responses', questions: 'Questions', timetable: 'Timetable', settings: 'Setup' };

  /**
   * The tab bar every page of a form shows. A tab is a link, so it also opens in a new window.
   * `pick(id)` may switch in place and return true; then the link is not followed.
   * `alerts` lists the tabs that need the admin (for example a timetable with no days).
   */
  A.formTabs = function (form, active, pick, alerts) {
    var ids = A.FORM_TABS.filter(function (id) { return id !== 'timetable' || form.type === 'reservation'; });
    return h('nav', { class: 'form-tabs', 'aria-label': 'Parts of this form' }, ids.map(function (id) {
      var href = '#/f/' + encodeURIComponent(form.slug) + (id === 'responses' ? '' : '/' + id);
      return h('a', { href: href, name: 'tab-' + id, 'aria-current': id === active ? 'page' : null, onclick: function (e) { if (pick && pick(id)) e.preventDefault(); } },
        TAB_LABEL[id], alerts && alerts.indexOf(id) !== -1 ? h('span', { class: 'tab-alert', title: 'Needs your attention' }, '!') : null);
    }));
  };

  /**
   * The header every tab of a form shows: what the form is, its status, and the same actions.
   * The status is saved the moment it is changed, on every tab, so the header never shows a status
   * that is not the saved one. A refused change puts the saved status back and says why.
   */
  A.formHead = function (form) {
    var t = A.TYPES[form.type] || { label: form.type };
    var link = A.formLink(form.slug);
    var refused = h('p', { class: 'error head-note', role: 'alert', hidden: true });
    var statusSel = A.select(form.status, A.STATUSES.map(function (st) { return [st, st === 'draft' ? 'Draft (hidden)' : A.STATUS_LABEL[st]]; }), function (v) {
      var was = form.status;
      refused.hidden = true;
      statusSel.disabled = true;
      A.call('admin.forms.update', { id: form.id, base: form.updatedAt, patch: { status: v } }).then(function (out) {
        form.status = out.form.status;
        form.updatedAt = out.form.updatedAt;
        toast('Status saved: ' + A.STATUS_LABEL[form.status], 'ok');
      }, function (e) {
        statusSel.value = was;
        refused.textContent = 'The status is still ' + A.STATUS_LABEL[was] + '. ' + A.message(e);
        refused.hidden = false;
      }).then(function () { statusSel.disabled = false; statusSel.dataset.status = form.status; });
    });
    statusSel.name = 'status';
    statusSel.dataset.status = form.status;
    return h('div', { class: 'page-head' },
      h('h2', null, form.title), A.termTags(form), h('span', { class: 'muted-note' }, t.label),
      h('label', { class: 'status-pick' }, h('span', { class: 'tool-label' }, 'Status'), statusSel),
      h('a', { class: 'btn btn-quiet sm', href: link, target: '_blank', rel: 'noopener' }, 'Open form'),
      copyLink(form, link),
      A.formMore(form, function () { A.unsaved = false; window.location.hash = '#/'; }),
      refused);
  };

  function copyLink(form, link) {
    return h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'copy-link', 'aria-label': 'Copy the link of ' + form.title, onclick: async function () { toast((await ui.copyText(link)) ? 'Form link copied' : 'Could not copy', 'ok'); } }, icon('link', 18), 'Copy link');
  }

  /** What is done to a form less often, the same on its card and in its header. */
  A.formMore = function (f, afterDelete) {
    var more = h('details', { class: 'more' },
      h('summary', { class: 'btn btn-quiet sm', 'aria-label': 'More actions for ' + f.title }, icon('menu', 18), 'More'),
      h('div', { class: 'more-menu', role: 'menu' },
        f.sheetUrl ? h('a', { role: 'menuitem', href: f.sheetUrl, target: '_blank', rel: 'noopener' }, icon('task', 16), 'Open Google Sheet') : null,
        h('button', { type: 'button', role: 'menuitem', name: 'rebuild', title: 'Write the tabs of the Google Sheet again from the saved answers. Use it when the sheet looks out of date.', onclick: function (e) {
          A.busy(e.currentTarget, async function () { await A.call('admin.views.rebuild', { slug: f.slug }); more.open = false; toast('Google Sheet views rebuilt', 'ok'); });
        } }, icon('refresh', 16), 'Rebuild sheet'),
        h('button', { type: 'button', role: 'menuitem', onclick: function () { more.open = false; duplicateDialog(f); } }, icon('copy', 16), 'Duplicate for a new term'),
        h('button', { type: 'button', role: 'menuitem', class: 'danger', name: 'delete-form', 'aria-label': 'Delete ' + f.title, onclick: function () { more.open = false; A.deleteForm(f, afterDelete); } }, icon('trash', 16), 'Delete form')));
    return more;
  };

  /** Changes the address without drawing the page again. */
  A.setHash = function (hash) { window.history.replaceState(null, '', hash); shown = hash; };

  /* ── Shell and routing ──────────────────────────────────────── */

  function route() {
    var parts = (window.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { name: 'forms', args: [] };
    if (parts[0] === 'new') return { name: 'create', args: [] };
    if (parts[0] === 'clients') return { name: 'clients', args: [] };
    if (parts[0] === 'lists') return { name: 'lists', args: [parts[1] || ''] };
    if (parts[0] === 'f' && parts[1]) return A.FORM_TABS.indexOf(parts[2]) > 0 ? { name: 'settings', args: [parts[1], parts[2]] } : { name: 'responses', args: [parts[1]] };
    return { name: 'forms', args: [] };
  }

  function navLink(href, text, active) {
    return h('a', { href: href, 'aria-current': active ? 'page' : null }, text);
  }

  var shown = '';

  async function render() {
    var root = document.getElementById('app');
    A.unsaved = false;
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
        ui.themeButton(),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Log out', onclick: function () { App.api.setPin(''); render(); } }, icon('logout', 20), h('span', { class: 'btn-text' }, 'Log out'))),
      mount));
    var view = A.views[r.name];
    try { await view.apply(null, [mount].concat(r.args)); } catch (e) {
      ui.clear(mount);
      mount.appendChild(h('div', { class: 'banner' }, e.message || 'Could not load this page.'));
      if (e.code === 'bad_pin') { App.api.setPin(''); render(); }
    }
  }

  A.start = function () {
    if (!started) {
      started = true;
      // A page with unsaved changes (A.unsaved) is left only after the admin agrees.
      shown = window.location.hash;
      window.addEventListener('hashchange', async function () {
        if (A.unsaved) {
          if (window.location.hash === shown) return;
          var leave = await ui.confirm({ title: 'Leave without saving?', body: 'Your changes on this page are not saved.', confirmText: 'Leave', danger: true });
          if (!leave) { window.location.hash = shown; return; }
        }
        shown = window.location.hash;
        render();
      });
      window.addEventListener('beforeunload', function (e) { if (A.unsaved) { e.preventDefault(); e.returnValue = ''; } });
      document.addEventListener('click', function (e) {
        Array.prototype.forEach.call(document.querySelectorAll('details.more[open]'), function (d) { if (!d.contains(e.target)) d.open = false; });
      });
    }
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
        // The refused PIN stays in its field, selected, so typing replaces it.
        err.textContent = ex.message;
        err.hidden = false;
        pin.focus();
        pin.select();
      } finally { btn.disabled = false; }
    } },
      h('h1', { class: 'step-title' }, 'Admin dashboard'),
      h('p', { class: 'help' }, 'Enter the admin PIN you set from the Forms Platform menu in the registry sheet.'),
      h('label', { class: 'field', for: 'pin' }, h('span', { class: 'label' }, 'Admin PIN')),
      pin, err, h('div', { class: 'nav' }, btn));
    root.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-top' }, ui.themeButton()), h('div', { class: 'sheet' }, h('div', { class: 'wrap' }, form))));
    pin.focus();
  }

  /* ── Forms list ─────────────────────────────────────────────── */

  A.views.forms = async function (mount) {
    var res = await A.call('admin.forms.list');
    // Grouped by status, and inside a status the newest form first.
    var forms = res.forms.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Forms'),
      h('a', { class: 'btn btn-primary', href: '#/new' }, icon('plus', 20), 'New form')));
    if (!forms.length) {
      mount.appendChild(h('div', { class: 'empty' }, 'No forms yet. Create the first one and choose what it collects.'));
      return;
    }
    // A booking that is opened with the keys of a form is listed under that form, not as a card of its own.
    var ids = forms.map(function (f) { return f.id; });
    var under = function (f) { var src = bookedBy(f); return src && ids.indexOf(src) !== -1 ? src : ''; };
    var cards = forms.filter(function (f) { return !under(f); });
    var known = function (f) { return A.STATUSES.indexOf(f.status) !== -1 ? f.status : 'draft'; };
    A.STATUSES.forEach(function (st) {
      var group = cards.filter(function (f) { return known(f) === st; });
      if (!group.length) return;
      mount.appendChild(h('section', { class: 'form-group', dataset: { status: st } },
        h('h3', { class: 'group-title' }, A.STATUS_LABEL[st], h('span', { class: 'group-count' }, String(group.length))),
        h('div', { class: 'cards' }, group.map(function (f) { return formCard(f, forms.filter(function (k) { return under(k) === f.id; })); }))));
    });
  };

  function formCard(f, kids) {
    var t = A.TYPES[f.type] || { label: f.type, icon: 'task' };
    var link = A.formLink(f.slug);
    return h('article', { class: 'card' + (kids && kids.length ? ' has-series' : ''), dataset: { slug: f.slug } },
      h('div', { class: 'card-top' }, h('span', { class: 'card-icon' }, icon(t.icon, 22)),
        h('div', null, h('h4', null, f.title), h('div', { class: 'card-tags' }, A.termTags(f)))),
      h('div', { class: 'actions' }, A.badge(A.STATUS_LABEL[f.status] || f.status, f.status), h('span', { class: 'muted-note' }, t.label), f.type === 'reservation' ? daysNote(f) : null),
      h('div', { class: 'actions card-actions' },
        h('a', { class: 'btn btn-primary sm', href: '#/f/' + encodeURIComponent(f.slug) }, 'Responses'),
        h('a', { class: 'btn btn-quiet sm', href: '#/f/' + encodeURIComponent(f.slug) + '/settings' }, 'Setup'),
        h('a', { class: 'btn btn-quiet sm', href: link, target: '_blank', rel: 'noopener' }, 'Open form'),
        copyLink(f, link),
        A.formMore(f)),
      series(f, kids || []));
  }

  /** A form that gives its students a key can have bookings that are opened with that key. */
  function issuesKeys(f) { return f.type !== 'reservation' && !!(f.editKey && f.editKey.enabled); }
  /** The first booking is offered where teams are: a team or a task form. */
  function hasTeams(f) { return f.type === 'team_registration' || f.type === 'task_submission'; }
  function bookedBy(f) { return f.type === 'reservation' && f.keyBooking && f.keyBooking.enabled ? f.keyBooking.source : ''; }

  /** The days a reservation offers. One with no days cannot be booked, so it says so and leads to the timetable. */
  function daysNote(f) {
    var days = ((f.slots && f.slots.days) || []);
    if (!days.length) return h('a', { class: 'badge none', name: 'no-days', href: '#/f/' + encodeURIComponent(f.slug) + '/timetable' }, 'No days yet');
    return h('span', { class: 'muted-note' }, days.length === 1 ? days[0].label : days[0].label + ' to ' + days[days.length - 1].label);
  }

  /** The bookings under a registration form, newest first, and the button that makes the next one. */
  function series(f, kids) {
    if (!kids.length && !(issuesKeys(f) && hasTeams(f))) return null;
    var make = function (title, btn) {
      return A.busy(btn, async function () {
        var res = await A.call('admin.bookings.next', { source: f.id, title: title || '' });
        toast(res.copied ? '"' + res.form.title + '" is a copy of the last booking, one week later. Check the days, then set it to Open.' : '"' + res.form.title + '" created as a draft. Add its days, then set it to Open.', 'ok');
        window.location.hash = '#/f/' + encodeURIComponent(res.form.slug) + '/timetable';
      });
    };
    var next = h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'next-booking', onclick: function (e) {
      if (kids.length) return make('', e.currentTarget);
      var title = 'Discussion - Week 1';
      A.modal('First booking for "' + f.title + '"', h('div', null,
        h('p', { class: 'help' }, 'Teams book a time with the key they got from this form, so they do not type their details again. Later bookings are copied from this one, one week later, and the number in the title goes up.'),
        A.field('Title', A.text(title, function (v) { title = v; }, { name: 'booking-title' }))), [
        { text: 'Cancel', kind: 'quiet' },
        { text: 'Create booking', kind: 'primary', onclick: function () { if (!title.trim()) { toast('Give the booking a title.', 'err'); return false; } return make(title); } }
      ]);
    } }, icon('plus', 16), kids.length ? 'New booking, one week later' : 'Add a booking for this form');
    if (!kids.length) return h('div', { class: 'series' }, next);
    // Bookings made earlier stay listed; a new one is offered only while the form still gives keys.
    if (!issuesKeys(f)) next = null;
    // Folded until asked for: a form can have a booking for every week of a term. The fold shows the newest one.
    var box = h('details', { class: 'series', open: seriesOpen(f.id), ontoggle: function () { seriesOpen(f.id, box.open); } },
      h('summary', { name: 'bookings-' + f.slug }, icon('calendar', 18), 'Bookings', h('span', { class: 'series-count' }, String(kids.length)),
        h('span', { class: 'series-latest' }, kids[0].title, A.badge(A.STATUS_LABEL[kids[0].status] || kids[0].status, kids[0].status))),
      h('ul', { class: 'series-list' }, kids.map(function (k) {
        var link = A.formLink(k.slug);
        return h('li', { dataset: { booking: k.slug } },
          h('a', { class: 'series-title', href: '#/f/' + encodeURIComponent(k.slug) }, k.title),
          h('span', { class: 'series-meta' }, A.badge(A.STATUS_LABEL[k.status] || k.status, k.status), daysNote(k)),
          h('span', { class: 'series-links' },
            h('a', { class: 'link-btn', href: '#/f/' + encodeURIComponent(k.slug) + '/timetable' }, 'Timetable'),
            h('button', { type: 'button', class: 'link-btn', 'aria-label': 'Copy the link of ' + k.title, onclick: async function () { toast((await ui.copyText(link)) ? 'Booking link copied' : 'Could not copy', 'ok'); } }, 'Copy link')));
      })),
      next);
    return box;
  }

  /** Which forms have their bookings unfolded, kept for the browser tab. Without storage, they stay folded. */
  function seriesOpen(id, open) {
    try {
      var all = JSON.parse(window.sessionStorage.getItem('forms.series') || '{}');
      if (open === undefined) return !!all[id];
      all[id] = open;
      window.sessionStorage.setItem('forms.series', JSON.stringify(all));
    } catch (e) { /* storage is not available */ }
    return false;
  }

  /** One confirmation, then the form is gone and its sheet is in the Drive trash. */
  A.deleteForm = async function (f, after) {
    var ok = await ui.confirm({
      title: 'Delete "' + f.title + '"?',
      body: 'Its link stops working right away and it leaves the dashboard and every instructor link. Its Google Sheet, with all registrations, moves to your Drive trash, where you can restore it for 30 days.',
      confirmText: 'Delete form', cancelText: 'Keep it', danger: true
    });
    if (!ok) return false;
    try {
      var r = await A.call('admin.forms.delete', { id: f.id, confirm: f.slug });
      toast(r.sheetTrashed ? 'Form deleted. Its sheet is in the Drive trash.' : 'Form deleted.', 'ok');
      if (after) after(); else A.render();
      return true;
    } catch (e) { A.fail(e); return false; }
  };

  function duplicateDialog(f) {
    var title = f.title, metadata = FormMetadata.read(f);
    var body = h('div', null,
      h('p', { class: 'help' }, 'The copy keeps every setting, starts as a draft, and gets its own empty Google Sheet.'),
      A.field('Title', A.text(title, function (v) { title = v; })),
      A.metadataEditor(f.type, metadata, function (v) { Object.assign(metadata, v); }));
    A.modal('Duplicate "' + f.title + '"', body, [
      { text: 'Cancel', kind: 'quiet' },
      { text: 'Make a copy', kind: 'primary', onclick: async function () {
        var res = await A.call('admin.forms.duplicate', Object.assign({ id: f.id, title: title }, metadata));
        toast('Copy created as a draft', 'ok');
        window.location.hash = '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
      } }
    ]);
  }

  /* ── Create ─────────────────────────────────────────────────── */

  /* ── New form: choose what it is for, name it, and see what students will get ── */

  A.views.create = async function (mount) {
    var state = { type: 'team_registration', title: '' };
    var metadata = {};
    Object.keys(A.TYPES).forEach(function (type) { metadata[type] = FormMetadata.defaults(type); });
    ui.clear(mount);

    var preview = h('div', { class: 'new-preview', 'aria-live': 'polite' });
    var nextBox = h('ul', { class: 'plain-list new-next' });
    function paintSide() {
      var t = A.TYPES[state.type];
      var title = state.title.trim();
      ui.clear(preview);
      preview.appendChild(h('span', { class: 'form-icon' }, icon(t.icon, 26)));
      preview.appendChild(h('p', { class: 'new-preview-title' + (title ? '' : ' empty') }, title || 'Your title'));
      preview.appendChild(h('div', { class: 'card-tags' }, A.termTags(Object.assign({ type: state.type }, metadata[state.type]))));
      preview.appendChild(h('ol', { class: 'new-pages' }, t.pages.concat(['Review']).map(function (name) { return h('li', null, name); })));
      ui.clear(nextBox);
      t.next.concat(['Change, add or move any question and page.', 'Set the status to Open when the form is ready.']).forEach(function (line) { nextBox.appendChild(h('li', null, line)); });
    }

    var metadataHost = h('div');
    function paintMetadata() {
      ui.clear(metadataHost);
      metadataHost.appendChild(A.metadataEditor(state.type, metadata[state.type], function (values) {
        Object.assign(metadata[state.type], values);
        paintSide();
      }));
    }
    var picks = Object.keys(A.TYPES).map(function (k) {
      var t = A.TYPES[k];
      return h('label', { class: 'type-opt' },
        h('input', { type: 'radio', name: 'type', value: k, checked: k === state.type, onchange: function () { state.type = k; paintMetadata(); paintSide(); } }),
        h('div', null, h('span', { class: 'type-icon' }, icon(t.icon, 24)), h('div', null, h('strong', null, t.label), h('p', null, t.text))));
    });

    // A refused title stays in its field with the reason next to it.
    var titleError = h('p', { class: 'error', id: 'new-title-err', role: 'alert', hidden: true }, 'Give the form a title first.');
    var titleInput = A.text('', function (v) { state.title = v; if (v.trim()) refuse(false); paintSide(); }, { name: 'title', placeholder: 'The heading students see', 'aria-describedby': 'new-title-err', autocomplete: 'off' });
    function refuse(on) { titleError.hidden = !on; titleInput.setAttribute('aria-invalid', on ? 'true' : 'false'); titleInput.classList.toggle('bad', !!on); }

    var btn = h('button', { type: 'submit', class: 'btn btn-primary', name: 'create' }, 'Create form');
    var numbered = function (n, title, help) {
      return h('div', { class: 'tt-step-head' }, h('span', { class: 'tt-num' }, String(n)), h('div', null, h('h3', null, title), help ? h('p', { class: 'help' }, help) : null));
    };
    paintMetadata();
    paintSide();
    mount.appendChild(h('form', { class: 'new-form', novalidate: 'novalidate', onsubmit: function (e) {
      e.preventDefault();
      if (!state.title.trim()) { refuse(true); if (titleInput.focus) titleInput.focus(); return; }
      A.busy(btn, async function () {
        var res = await A.call('admin.forms.create', Object.assign({ type: state.type, title: state.title }, metadata[state.type]));
        toast('Form created as a draft. Check its settings, then open it.', 'ok');
        window.location.hash = '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
      });
    } },
      h('div', { class: 'page-head' }, h('h2', null, 'New form'), h('a', { class: 'btn btn-quiet sm', href: '#/' }, 'Cancel')),
      h('div', { class: 'l-split' },
        h('div', { class: 'l-main' },
          h('section', { class: 'panel' }, numbered(1, 'What is the form for?', 'This decides the pages and questions the form starts with. You can change them after.'),
            h('div', { class: 'type-pick l-grid', role: 'radiogroup', 'aria-label': 'What the form is for' }, picks)),
          h('section', { class: 'panel' }, numbered(2, 'Name it'),
            h('label', { class: 'field-row' }, h('span', { class: 'label' }, 'Title'), titleInput, titleError),
            metadataHost)),
        h('aside', { class: 'l-side new-side' },
          h('section', { class: 'panel l-stack' },
            h('span', { class: 'tool-label' }, 'What students will see'), preview,
            h('span', { class: 'tool-label' }, 'After you create it'), nextBox,
            h('p', { class: 'muted-note' }, 'The form starts as a draft. Students cannot open it until you set it to Open.'),
            btn)))));
  };
})(window.App = window.App || {});
