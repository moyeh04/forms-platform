/**
 * Admin responses. Every team, day, or registration is its own block with a
 * tint and a heavy border, matching the Google Sheet, so names line up with
 * their project, task, or slot at a glance.
 */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast, A = App.admin;

  function bdi(text) { return h('bdi', { lang: 'ar' }, text || ''); }

  function slotText(form, slot) {
    if (!slot) return '';
    var day = ((form.slots && form.slots.days) || []).filter(function (d) { return d.id === slot.day; })[0];
    return (day ? day.label : slot.day) + ' - ' + slot.time;
  }

  function haystack(form, s) {
    var members = Rules.membersOf(form, s.data).map(function (m) { return m.name + ' ' + m.code + ' ' + m.phone; }).join(' ');
    return [s.ref, s.email, s.name, s.code, s.phone, s.title, members].join(' ').toLowerCase();
  }

  /* ── Page ───────────────────────────────────────────────────── */

  A.views.responses = async function (mount, slug) {
    var both = await Promise.all([A.call('admin.forms.get', { id: slug }), A.call('admin.submissions', { slug: slug })]);
    var form = both[0].form;
    var all = both[1].submissions;
    var state = { q: '', status: 'all', tab: form.type === 'whatsapp_registration' && form.matching && form.matching.enabled ? 'matching' : 'list' };
    var link = A.formLink(form.slug);
    var t = A.TYPES[form.type] || { label: form.type };

    var content = h('div');
    var stats = h('div', { class: 'stats' });

    function reload() { A.render(); }

    function paintStats() {
      ui.clear(stats);
      stats.appendChild(h('span', { class: 'stat' }, h('b', null, String(all.length)), 'Total'));
      A.SUB_STATUSES.forEach(function (st) {
        var n = all.filter(function (s) { return s.status === st; }).length;
        if (n) stats.appendChild(h('span', { class: 'stat' }, h('b', null, String(n)), A.SUB_LABEL[st]));
      });
    }

    function filtered() {
      var q = state.q.trim().toLowerCase();
      return all.filter(function (s) { return (state.status === 'all' || s.status === state.status) && (!q || haystack(form, s).indexOf(q) !== -1); });
    }

    function paint() {
      ui.clear(content);
      if (form.type === 'whatsapp_registration' && form.matching && form.matching.enabled) {
        content.appendChild(h('div', { class: 'actions', style: { marginBottom: '14px' }, role: 'tablist' },
          h('button', { type: 'button', class: 'btn sm ' + (state.tab === 'matching' ? 'btn-primary' : 'btn-quiet'), role: 'tab', 'aria-selected': state.tab === 'matching' ? 'true' : 'false', name: 'tab-matching', onclick: function () { state.tab = 'matching'; paint(); } }, 'Match WhatsApp requests'),
          h('button', { type: 'button', class: 'btn sm ' + (state.tab === 'list' ? 'btn-primary' : 'btn-quiet'), role: 'tab', 'aria-selected': state.tab === 'list' ? 'true' : 'false', name: 'tab-list', onclick: function () { state.tab = 'list'; paint(); } }, 'All registrations')));
        if (state.tab === 'matching') { stats.hidden = true; return matchingView(form, content); }
      }
      stats.hidden = false;
      var rows = filtered();
      if (!rows.length) return content.appendChild(h('div', { class: 'empty' }, all.length ? 'Nothing matches that search.' : 'No submissions yet. Share the form link to start collecting.'));
      if (form.type === 'reservation') content.appendChild(bookings(form, rows, reload));
      else if (form.type === 'whatsapp_registration') content.appendChild(registrations(form, rows, reload));
      else content.appendChild(teams(form, rows, reload));
    }

    /* Toolbar -------------------------------------------------- */
    var search = h('input', { class: 'input', type: 'search', name: 'search', placeholder: 'Search name, code, phone, project', 'aria-label': 'Search', oninput: function (e) { state.q = e.target.value; paint(); } });
    var statusSel = A.select('all', [['all', 'All statuses']].concat(A.SUB_STATUSES.map(function (s) { return [s, A.SUB_LABEL[s]]; })), function (v) { state.status = v; paint(); });
    statusSel.setAttribute('aria-label', 'Filter by status');
    var tools = [search, statusSel,
      h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: reload }, icon('refresh', 18), 'Refresh'),
      h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function () { exportCsv(form, filtered()); } }, icon('download', 18), 'Download CSV')];
    if (form.type === 'team_registration' || form.type === 'task_submission') {
      tools.push(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'printTeams', onclick: function (e) { printOut(e.currentTarget, 'admin.print.teamList', {}); } }, icon('printer', 18), 'Print team list'));
    }
    if (form.type === 'reservation') {
      var day = ((form.slots && form.slots.days) || [])[0];
      var dayId = day ? day.id : '';
      var empty = false;
      var daySel = A.select(dayId, ((form.slots && form.slots.days) || []).map(function (d) { return [d.id, d.label]; }), function (v) { dayId = v; });
      daySel.setAttribute('aria-label', 'Day to print');
      tools.push(daySel, A.check('Include empty slots', false, function (v) { empty = v; }),
        h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'printDay', onclick: function (e) { if (!dayId) return toast('Add a day in the settings first.', 'err'); printOut(e.currentTarget, 'admin.print.reservations', { dayId: dayId, includeEmpty: empty }); } }, icon('printer', 18), 'Print this day'));
    }
    tools.push(h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function (e) {
      A.busy(e.currentTarget, async function () { await A.call('admin.views.rebuild', { slug: form.slug }); toast('Google Sheet views rebuilt', 'ok'); });
    } }, 'Rebuild sheet'));

    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' },
      h('h2', null, form.title), A.termTags(form), A.badge(A.STATUS_LABEL[form.status] || form.status, form.status),
      h('span', { class: 'muted-note' }, t.label),
      h('a', { class: 'btn btn-quiet sm', href: '#/f/' + encodeURIComponent(form.slug) + '/settings' }, 'Settings'),
      h('a', { class: 'btn btn-quiet sm', href: form.sheetUrl, target: '_blank', rel: 'noopener' }, 'Google Sheet'),
      h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(link)) ? 'Form link copied' : 'Could not copy', 'ok'); } }, icon('link', 18), 'Copy form link')));
    paintStats();
    mount.appendChild(stats);
    mount.appendChild(h('div', { class: 'toolbar' }, tools));
    mount.appendChild(content);
    paint();
  };

  /* ── Shared row controls ────────────────────────────────────── */

  function statusSelect(form, s) {
    var sel = A.select(s.status, A.SUB_STATUSES.map(function (x) { return [x, A.SUB_LABEL[x]]; }), function (v) {
      A.call('admin.submission.update', { slug: form.slug, submissionId: s.id, patch: { status: v } })
        .then(function () { s.status = v; toast('Status updated', 'ok'); }).catch(A.fail);
    });
    sel.setAttribute('aria-label', 'Status of ' + s.ref);
    return sel;
  }

  function reviewSelect(form, s, step) {
    var sel = A.select((s.review || {})[step.id] || 'pending', A.REVIEW.map(function (x) { return [x, A.SUB_LABEL[x]]; }), function (v) {
      var patch = { review: {} };
      patch.review[step.id] = v;
      A.call('admin.submission.update', { slug: form.slug, submissionId: s.id, patch: patch })
        .then(function () { s.review[step.id] = v; toast(step.label.en + ': ' + v, 'ok'); }).catch(A.fail);
    });
    sel.setAttribute('aria-label', step.label.en + ' for ' + s.ref);
    return sel;
  }

  function detailsButton(form, s, reload) {
    return h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'details', onclick: function () { details(form, s, reload); } }, 'Details');
  }

  function details(form, s, reload) {
    var rows = [h('dt', null, 'Reference'), h('dd', null, s.ref), h('dt', null, 'Sent'), h('dd', null, A.fmtDate(s.created))];
    (form.fields || []).forEach(function (f) {
      var v = s.data[f.id];
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
      var node;
      if (f.type === 'members') node = h('div', null, v.map(function (m) { return h('div', null, bdi(m.name), ' ', h('span', { class: 'mono' }, m.code), ' ', h('span', { class: 'mono' }, m.phone)); }));
      else if (f.type === 'slot') node = slotText(form, v);
      else if (f.type === 'drive_link') node = h('a', { href: v, target: '_blank', rel: 'noopener' }, 'Open link');
      else if (f.type === 'arabic_name') node = bdi(v);
      else node = String(v);
      rows.push(h('dt', null, f.label.en), h('dd', null, node));
    });
    if (form.editKey && form.editKey.enabled) {
      var keyBox = h('dd', { class: 'key-cell' });
      var paintKey = function () {
        ui.clear(keyBox);
        keyBox.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'show-key', onclick: function (e) {
          A.busy(e.currentTarget, async function () {
            var k = await A.call('admin.submission.key', { slug: form.slug, submissionId: s.id });
            ui.clear(keyBox);
            keyBox.appendChild(h('span', { class: 'key-inline' }, k.key));
            keyBox.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(k.key)) ? 'Key copied' : 'Could not copy', 'ok'); } }, icon('copy', 16), 'Copy'));
            keyBox.appendChild(h('span', { class: 'muted-note' }, (k.expired ? 'Expired on ' : 'Works until ') + A.fmtDate(k.keyExpires) + (k.expired ? '. Reset it to give a fresh one.' : '')));
          });
        } }, icon('eye', 16), 'Show key'));
        if (!s.keyKnown) keyBox.appendChild(h('span', { class: 'muted-note' }, 'Issued before keys could be shown: use Reset key below.'));
      };
      paintKey();
      rows.splice(4, 0, h('dt', null, 'Edit key'), keyBox);
    }
    var steps = ((form.review && form.review.steps) || []).map(function (st) { return h('div', { class: 'row' }, A.field(st.label.en, reviewSelect(form, s, st))); });
    var body = h('div', { class: 'detail' }, h('dl', null, rows), steps);
    A.modal('Registration ' + s.ref, body, [
      { text: 'Reset key', kind: 'quiet', onclick: async function () {
        var r = await A.call('admin.submission.resetKey', { slug: form.slug, submissionId: s.id });
        s.keyKnown = true;
        A.reveal('New key for ' + r.ref, 'Give this key to the student. They open the form link and choose "Edit or cancel with your key". It works until ' + A.fmtDate(r.keyExpires) + '. The old key stops working. You can see it again any time under Details.', r.key, true);
        return false;
      } },
      { text: 'Delete', kind: 'danger', onclick: async function (close) {
        close();
        var ok = await ui.confirm({ title: 'Delete ' + s.ref + '?', body: 'This frees its code' + (s.slot ? ' and its slot' : '') + ' so the team can register again.', confirmText: 'Delete', danger: true });
        if (!ok) return false;
        await A.call('admin.submission.delete', { slug: form.slug, submissionId: s.id });
        toast('Deleted', 'ok');
        reload();
        return false;
      } },
      { text: 'Close', kind: 'quiet' }
    ]);
  }

  /* ── Teams and tasks ────────────────────────────────────────── */

  function teams(form, rows, reload) {
    var sorted = rows.slice().sort(function (a, b) { return String(a.created).localeCompare(String(b.created)); });
    var third = form.type === 'task_submission' ? 'Task' : 'Project';
    return h('div', { class: 'team-list' }, sorted.map(function (s, i) {
      var members = Rules.membersOf(form, s.data);
      var title = s.title || '-';
      return h('article', { class: 'block team-card ' + (i % 2 ? 'tint-b' : 'tint-a'), dataset: { ref: s.ref } },
        h('header', { class: 'block-head' },
          h('span', { class: 'team-no' }, 'Team ' + (i + 1)),
          h('div', { class: 'block-side block-title' }, h('span', { class: 'kicker' }, third),
            s.link ? h('a', { href: s.link, target: '_blank', rel: 'noopener' }, title, icon('link', 15)) : h('span', null, title)),
          h('span', { class: 'block-meta' }, h('span', { class: 'mono' }, s.ref), ' · ', members.length === 1 ? 'Solo' : members.length + ' members'),
          h('div', { class: 'actions block-actions' }, statusSelect(form, s), detailsButton(form, s, reload))),
       h('div', { class: 'scroll-x' }, h('table', { class: 'mini' },
          h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Team member'), h('th', null, 'Section'), h('th', null, 'Code'), h('th', null, 'Phone'))),
         h('tbody', null, members.map(function (m, k) {
           return h('tr', { class: m.leader ? 'leader' : null },
             h('td', { class: 'num' }, String(k + 1)),
             h('td', { class: 'nm' }, bdi(m.name), m.leader ? h('span', { class: 'lead-tag' }, icon('star', 13), 'Leader') : null),
              h('td', null, m.section || '-'), h('td', { class: 'mono' }, m.code), h('td', { class: 'mono' }, m.phone));
         })))));
    }));
  }

  /* ── Reservations ───────────────────────────────────────────── */

  function bookings(form, rows, reload) {
    var days = (form.slots && form.slots.days) || [];
    var groups = [];
    days.forEach(function (d) { groups.push({ id: d.id, label: d.label, date: d.date, times: d.times, rows: [] }); });
    rows.forEach(function (s) {
      var id = s.data.slot ? s.data.slot.day : '';
      var g = groups.filter(function (x) { return x.id === id; })[0];
      if (!g) { g = { id: id, label: 'Slot no longer on the timetable', date: '', times: [], rows: [] }; groups.push(g); }
      g.rows.push(s);
    });
    groups = groups.filter(function (g) { return g.rows.length; });
    return h('div', null, groups.map(function (g, i) {
      g.rows.sort(function (a, b) { return g.times.indexOf(a.data.slot.time) - g.times.indexOf(b.data.slot.time); });
      return h('section', { class: 'block single ' + (i % 2 ? 'tint-b' : 'tint-a'), dataset: { day: g.id } },
        h('div', { class: 'day-head' }, h('span', null, g.label + (g.date ? ' (' + g.date + ')' : '')), h('span', null, g.rows.length + ' booked')),
        h('div', { class: 'scroll-x' }, h('table', { class: 'mini' },
          h('thead', null, h('tr', null, h('th', null, 'Time'), h('th', null, 'Team leader'), h('th', null, 'Code'), h('th', null, 'Phone'), h('th', null, 'Project'), h('th', null, 'Status'), h('th', null))),
          h('tbody', null, g.rows.map(function (s) {
            var L = function (label, td) { td.dataset.label = label; return td; };
            return h('tr', null, L('Time', h('td', { class: 'mono' }, s.data.slot.time)), L('Team leader', h('td', { class: 'nm' }, bdi(s.name))), L('Code', h('td', { class: 'mono' }, s.code)), L('Phone', h('td', { class: 'mono' }, s.phone)), L('Project', h('td', null, s.title)), L('Status', h('td', null, statusSelect(form, s))), h('td', null, detailsButton(form, s, reload)));
          })))));
    }));
  }

  /* ── WhatsApp registrations ─────────────────────────────────── */

  function registrations(form, rows, reload) {
    var steps = (form.review && form.review.steps) || [];
    var sorted = rows.slice().sort(function (a, b) {
      var ga = String(a.data.group), gb = String(b.data.group);
      return ga === gb ? (parseInt(a.data.section, 10) || 0) - (parseInt(b.data.section, 10) || 0) : (ga < gb ? -1 : 1);
    });
    return h('div', { class: 'scroll-x' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['No.', 'Name', 'Code', 'Phone', 'Group', 'Section', 'Timetable'].concat(steps.map(function (s) { return s.label.en; })).concat(['Status', '']).map(function (c) { return h('th', null, c); }))),
      h('tbody', null, sorted.map(function (s, i) {
        return h('tr', { dataset: { ref: s.ref } }, h('td', null, String(i + 1)), h('td', { class: 'nm' }, bdi(s.name)), h('td', { class: 'mono' }, s.code), h('td', { class: 'mono' }, s.phone),
          h('td', null, s.data.group || ''), h('td', null, s.data.section || ''),
          h('td', null, s.link ? h('a', { href: s.link, target: '_blank', rel: 'noopener' }, 'Open') : ''),
          steps.map(function (st) { return h('td', null, reviewSelect(form, s, st)); }),
          h('td', null, statusSelect(form, s)), h('td', null, detailsButton(form, s, reload)));
      }))));
  }

  /* ── WhatsApp matching: requests left, registration right ───── */

  async function matchingView(form, host) {
    var state = { data: null, filter: 'all', sel: null, note: '' };
    var left = h('div', { class: 'panel' });
    var right = h('div', { class: 'panel detail' });
    host.appendChild(h('div', { class: 'split' }, left, right));

    async function load(keepSelection) {
      state.data = await A.call('admin.matching.list', { slug: form.slug });
      if (!keepSelection || !state.data.requests.some(function (r) { return r.id === state.sel; })) state.sel = null;
      paint();
    }

    function subOf(id) { return state.data.submissions.filter(function (s) { return s.id === id; })[0]; }

    function visible() {
      return state.data.requests.filter(function (r) {
        var f = state.filter;
        if (f === 'all') return true;
        if (f === 'matched' || f === 'none' || f === 'duplicate') return r.status === f;
        return r.decision === f;
      });
    }

    function paintLeft() {
      ui.clear(left);
      var ta = h('textarea', { class: 'textarea', rows: '5', name: 'paste', placeholder: 'Paste the pending WhatsApp requests here.\nOne per line, each with the phone number.', dir: 'ltr', 'aria-label': 'Pasted WhatsApp requests' });
      var addBtn = h('button', { type: 'button', class: 'btn btn-primary sm', name: 'import' }, 'Add to the list');
      addBtn.addEventListener('click', function () {
        A.busy(addBtn, async function () {
          var r = await A.call('admin.matching.import', { slug: form.slug, text: ta.value });
          var msg = 'Added ' + r.added + (r.duplicates ? ', ' + r.duplicates + ' already in the list' : '') + (r.unparsed.length ? ', ' + r.unparsed.length + ' line(s) had no phone number' : '');
          toast(msg, r.added ? 'ok' : 'err');
          await load(true);
        });
      });
      var counts = { all: state.data.requests.length };
      ['matched', 'none', 'duplicate'].forEach(function (k) { counts[k] = state.data.requests.filter(function (r) { return r.status === k; }).length; });
      ['pending', 'approved', 'rejected'].forEach(function (k) { counts[k] = state.data.requests.filter(function (r) { return r.decision === k; }).length; });
      var filters = [['all', 'All'], ['pending', 'Pending'], ['matched', 'Matched'], ['none', 'No match'], ['duplicate', 'Duplicate'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(function (f) {
        return h('button', { type: 'button', class: 'btn sm ' + (state.filter === f[0] ? 'btn-primary' : 'btn-quiet'), dataset: { filter: f[0] }, 'aria-pressed': state.filter === f[0] ? 'true' : 'false', onclick: function () { state.filter = f[0]; paint(); } }, f[1] + ' (' + counts[f[0]] + ')');
      });
      var list = visible().map(function (r) {
        return h('button', { type: 'button', class: 'req', dataset: { id: r.id }, 'aria-pressed': state.sel === r.id ? 'true' : 'false', onclick: function () { state.sel = r.id; paint(); } },
          h('span', null, r.label ? bdi(r.label) : '(no name)'), h('span', { class: 'mono' }, r.phone),
          h('span', { class: 'req-badges' }, A.badge(r.status === 'none' ? 'No match' : r.status === 'matched' ? 'Matched' : 'Duplicate', r.status), A.badge(A.SUB_LABEL[r.decision] || r.decision, r.decision)));
      });
      left.appendChild(h('h2', null, 'WhatsApp requests'));
      left.appendChild(h('p', { class: 'help' }, 'WhatsApp does not let websites read join requests, so paste them here. Each phone number is matched to what the student submitted.'));
      left.appendChild(ta);
      left.appendChild(h('div', { class: 'actions', style: { marginTop: '8px' } }, addBtn));
      left.appendChild(h('div', { class: 'actions', style: { marginTop: '14px' } }, filters));
      left.appendChild(list.length ? h('div', { class: 'req-list' }, list) : h('div', { class: 'empty', style: { marginTop: '10px' } }, state.data.requests.length ? 'No requests in this filter.' : 'No requests yet. Paste the list above.'));
      if (state.data.notRequested.length) {
        left.appendChild(h('p', { class: 'muted-note', style: { marginTop: '12px' } }, state.data.notRequested.length + ' registration(s) have no matching WhatsApp request yet.'));
      }
    }

    function decide(q, decision) {
      return A.call('admin.matching.decide', { slug: form.slug, requestId: q.id, decision: decision, note: state.note }).then(function () {
        toast(decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Back to pending', 'ok');
        var order = visible().map(function (r) { return r.id; });
        var at = order.indexOf(q.id);
        var nextPending = state.data.requests.filter(function (r) { return order.indexOf(r.id) > at && r.decision === 'pending' && r.id !== q.id; })[0];
        state.note = '';
        return load(false).then(function () { if (decision !== 'pending' && nextPending) { state.sel = nextPending.id; paint(); } });
      }).catch(A.fail);
    }

    function paintRight() {
      ui.clear(right);
      var q = state.data.requests.filter(function (r) { return r.id === state.sel; })[0];
      if (!q) return right.appendChild(h('div', { class: 'empty' }, 'Choose a request on the left to see the student\'s registration and timetable.'));
      right.appendChild(h('h2', null, q.label ? bdi(q.label) : q.phone));
      right.appendChild(h('div', { class: 'actions', style: { marginBottom: '12px' } }, h('span', { class: 'mono' }, q.phone), A.badge(q.status === 'none' ? 'No match' : q.status === 'matched' ? 'Matched' : 'Duplicate', q.status), A.badge(A.SUB_LABEL[q.decision] || q.decision, q.decision)));

      var matches = q.matches.map(subOf).filter(Boolean);
      if (!matches.length) right.appendChild(h('p', null, 'No registration uses this phone number. Ask the student to register, or check that they used the same number in WhatsApp.'));
      if (matches.length > 1) right.appendChild(h('p', { class: 'banner info' }, 'More than one registration uses this number. Check them below before deciding.'));
      matches.forEach(function (s) {
        var d = s.data;
        right.appendChild(h('dl', null,
          h('dt', null, 'Name'), h('dd', null, bdi(s.name)), h('dt', null, 'Code'), h('dd', { class: 'mono' }, s.code),
          h('dt', null, 'Level'), h('dd', null, d.level || ''), h('dt', null, 'Major'), h('dd', null, d.major || ''),
          h('dt', null, 'Group and section'), h('dd', null, (d.group || '') + ' / ' + (d.section || '')),
          ((form.review && form.review.steps) || []).map(function (st) { return [h('dt', null, st.label.en), h('dd', null, reviewSelect(form, s, st))]; })));
        var p = s.link ? Rules.parseDriveLink(s.link) : { ok: false };
        if (p.ok) {
          right.appendChild(h('div', { class: 'actions', style: { marginBottom: '8px' } }, h('a', { class: 'btn btn-quiet sm', href: s.link, target: '_blank', rel: 'noopener' }, 'Open timetable in Drive')));
          right.appendChild(h('iframe', { class: 'preview', src: 'https://drive.google.com/file/d/' + p.id + '/preview', title: 'Timetable screenshot of ' + s.name, loading: 'lazy' }));
        }
      });

      var note = A.text(state.note, function (v) { state.note = v; }, { name: 'note', placeholder: 'Note (optional)' });
      right.appendChild(h('div', { style: { marginTop: '14px' } }, A.field('Note', note)));
      right.appendChild(h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn-primary', name: 'approve', onclick: function (e) { A.busy(e.currentTarget, function () { return decide(q, 'approved'); }); } }, icon('check', 20), 'Approve'),
        h('button', { type: 'button', class: 'btn btn-danger', name: 'reject', onclick: function (e) { A.busy(e.currentTarget, function () { return decide(q, 'rejected'); }); } }, icon('x', 20), 'Reject'),
        h('button', { type: 'button', class: 'btn btn-quiet', name: 'pending', onclick: function (e) { A.busy(e.currentTarget, function () { return decide(q, 'pending'); }); } }, 'Back to pending'),
        h('button', { type: 'button', class: 'btn btn-quiet', name: 'remove', onclick: function (e) {
          A.busy(e.currentTarget, async function () { await A.call('admin.matching.remove', { slug: form.slug, requestIds: [q.id] }); toast('Removed from the list', 'ok'); await load(false); });
        } }, icon('trash', 18), 'Remove from list')));
      if (q.note) right.appendChild(h('p', { class: 'muted-note' }, 'Saved note: ' + q.note));
    }

    function paint() { paintLeft(); paintRight(); }
    await load(false);
  }

  /* ── Print and export ───────────────────────────────────────── */

  function printOut(btn, action, extra) {
    A.busy(btn, async function () {
      var r = await A.call(action, Object.assign({}, extra));
      var body = h('div', null,
        h('p', null, r.count + ' row(s) are ready in a print tab of the Google Sheet.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-primary', href: r.sheetUrl, target: '_blank', rel: 'noopener' }, 'Open print tab'),
          r.pdfUrl ? h('a', { class: 'btn btn-quiet', href: r.pdfUrl, target: '_blank', rel: 'noopener' }, 'Open PDF') : null),
        r.pdfUrl ? null : h('p', { class: 'help' }, 'The PDF could not be made automatically. Open the print tab and use File > Print.'));
      A.modal('Ready to print', body);
    });
  }

  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

  function exportCsv(form, rows) {
    var head = ['Reference', 'Sent', 'Status', 'Name', 'Code', 'Phone', 'Email', 'Title', 'Link', 'Slot', 'Members'];
    var lines = [head].concat(rows.map(function (s) {
      return [s.ref, s.created, s.status, s.name, s.code, s.phone, s.email, s.title, s.link, slotText(form, s.data.slot), s.members];
    }));
    var csv = '\ufeff' + lines.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    try {
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      var a = h('a', { href: url, download: form.slug + '.csv' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { toast('Could not make the file here.', 'err'); }
  }
})(window.App = window.App || {});
