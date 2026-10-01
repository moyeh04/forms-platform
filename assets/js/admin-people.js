/** Admin: instructor and client links, and the shared lists behind dropdowns. */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast, A = App.admin;

  var COLUMNS = [
    ['time', 'Time'], ['name', 'Name'], ['code', 'Code'], ['phone', 'Phone'], ['email', 'Email'], ['title', 'Project or task'],
    ['level', 'Level'], ['section', 'Section'], ['group', 'Group'], ['link', 'Link'], ['review', 'Review']
  ];

  /* ── Clients ────────────────────────────────────────────────── */

  A.views.clients = async function (mount) {
    var both = await Promise.all([A.call('admin.clients.list'), A.call('admin.forms.list')]);
    var clients = both[0].clients;
    var forms = both[1].forms;
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Clients and instructors'),
      h('button', { type: 'button', class: 'btn btn-primary', name: 'newClient', onclick: function () { clientDialog(null, forms); } }, icon('plus', 20), 'New private link')));
    mount.appendChild(h('p', { class: 'help' }, 'A private link lets an instructor or client see chosen forms without a Google account or a PIN. It is read-only, and you choose which columns they see. Turn a link off at any time.'));
    if (!clients.length) return mount.appendChild(h('div', { class: 'empty' }, 'No private links yet.'));

    mount.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['Name', 'Can see', 'Hidden columns', 'Can review', 'Link', ''].map(function (c) { return h('th', null, c); }))),
      h('tbody', null, clients.map(function (c) {
        var access = c.forms.indexOf('*') !== -1 ? 'All forms' : c.forms.map(function (s) { var f = forms.filter(function (x) { return x.slug === s; })[0]; return f ? f.title : s; }).join(', ');
        return h('tr', { dataset: { client: c.id } },
          h('td', null, h('strong', null, c.name)), h('td', null, access || 'No forms'),
          h('td', null, c.hiddenColumns.length ? c.hiddenColumns.join(', ') : 'None'), h('td', null, c.canReview ? 'Yes' : 'No'),
          h('td', null, A.badge(c.active ? 'On' : 'Off', c.active ? 'open' : 'closed')),
          h('td', null, h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'edit', onclick: function () { clientDialog(c, forms); } }, 'Edit'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'regenerate', onclick: function (e) {
              A.busy(e.currentTarget, async function () {
                var ok = await ui.confirm({ title: 'Make a new link for ' + c.name + '?', body: 'The old link stops working right away.', confirmText: 'Make new link' });
                if (!ok) return;
                var r = await A.call('admin.clients.regenerate', { id: c.id });
                A.reveal('New link for ' + c.name, 'Copy it now. For safety it is shown only once.', A.viewerLink(r.token));
                A.render();
              });
            } }, 'New link'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'toggle', onclick: function (e) {
              A.busy(e.currentTarget, async function () { await A.call('admin.clients.update', { id: c.id, patch: { active: !c.active } }); toast(c.active ? 'Link turned off' : 'Link turned on', 'ok'); A.render(); });
            } }, c.active ? 'Turn off' : 'Turn on'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'delete', onclick: function (e) {
              A.busy(e.currentTarget, async function () {
                var ok = await ui.confirm({ title: 'Delete ' + c.name + '?', body: 'Their link stops working and cannot be restored.', confirmText: 'Delete', danger: true });
                if (!ok) return;
                await A.call('admin.clients.remove', { id: c.id });
                toast('Deleted', 'ok');
                A.render();
              });
            } }, icon('trash', 18)))));
      })))));
  };

  function clientDialog(client, forms) {
    var st = {
      name: client ? client.name : '', all: client ? client.forms.indexOf('*') !== -1 : false,
      forms: client ? client.forms.filter(function (s) { return s !== '*'; }) : [], hidden: client ? client.hiddenColumns.slice() : [], canReview: client ? client.canReview : false
    };
    var formBoxes = h('div', null, forms.map(function (f) {
      return A.check(f.title + (f.term ? ' (' + f.term + ')' : ''), st.forms.indexOf(f.slug) !== -1, function (v) {
        st.forms = st.forms.filter(function (s) { return s !== f.slug; });
        if (v) st.forms.push(f.slug);
      });
    }));
    var body = h('div', null,
      A.field('Name', A.text(st.name, function (v) { st.name = v; }, { name: 'clientName', placeholder: 'Dr. Ahmed - Database seminar' }), 'Only you see this.'),
      h('div', { class: 'field-row' }, h('span', { class: 'label' }, 'Forms they can see'),
        A.check('All forms, including ones I create later', st.all, function (v) { st.all = v; }), formBoxes),
      h('div', { class: 'field-row' }, h('span', { class: 'label' }, 'Hide these columns'),
        h('div', { class: 'row' }, COLUMNS.map(function (c) {
          return A.check(c[1], st.hidden.indexOf(c[0]) !== -1, function (v) { st.hidden = st.hidden.filter(function (x) { return x !== c[0]; }); if (v) st.hidden.push(c[0]); });
        }))),
      A.check('Allow them to mark review steps as approved or rejected', st.canReview, function (v) { st.canReview = v; }));
    A.modal(client ? 'Edit ' + client.name : 'New private link', body, [
      { text: 'Cancel', kind: 'quiet' },
      { text: client ? 'Save' : 'Create link', kind: 'primary', onclick: async function () {
        if (!st.name.trim()) { toast('Give this person or group a name.', 'err'); return false; }
        var formsList = st.all ? ['*'] : st.forms;
        if (!formsList.length) { toast('Choose at least one form.', 'err'); return false; }
        if (client) {
          await A.call('admin.clients.update', { id: client.id, patch: { name: st.name, forms: formsList, hiddenColumns: st.hidden, canReview: st.canReview } });
          toast('Saved', 'ok');
        } else {
          var r = await A.call('admin.clients.create', { name: st.name, forms: formsList, hiddenColumns: st.hidden, canReview: st.canReview });
          A.reveal('Link for ' + r.client.name, 'Send this link to them. For safety it is shown only once; you can always make a new one.', A.viewerLink(r.token));
        }
        A.render();
      } }
    ]);
  }

  /* ── Lists ──────────────────────────────────────────────────── */

  /** What each shared list is for, and which form types ask it by default. */
  var LIST_INFO = {
    levels: { name: 'Levels', about: 'The level or year question.', types: ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'] },
    curricula: { name: 'Bylaws', about: 'The bylaw (curriculum year) question.', types: ['team_registration', 'task_submission', 'reservation'] },
    majors: { name: 'Majors', about: 'Specializations. A form can also be limited to some of them in its settings.', types: ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'] },
    sections: { name: 'Sections', about: 'Lecture sections such as 4C-TH1.', types: ['team_registration', 'task_submission', 'reservation'] },
    groups: { name: 'Groups', about: 'WhatsApp group letters (A with Chemistry, B without).', types: ['whatsapp_registration'] },
    wa_sections: { name: 'WhatsApp section numbers', about: 'The number next to TH in a student timetable.', types: ['whatsapp_registration'] }
  };

  function listName(key) { return (LIST_INFO[key] && LIST_INFO[key].name) || key; }

  /** Forms whose questions (or member questions) read this list. */
  function formsUsing(forms, key) {
    return forms.filter(function (f) {
      var uses = function (fields) { return (fields || []).some(function (x) { return x.list === key || uses(x.fields); }); };
      return f.status !== 'archived' && uses(f.fields);
    });
  }

  function toRows(values) {
    return (values || []).map(function (o) {
      var label = o.label || {};
      return { value: String(o.value), en: label.en && label.en !== String(o.value) ? label.en : '', ar: label.ar && label.ar !== String(o.value) ? label.ar : '' };
    });
  }

  function fromRows(rows) {
    return rows.filter(function (r) { return r.value.trim(); }).map(function (r) {
      var v = r.value.trim();
      return { value: v, label: { en: r.en.trim() || v, ar: r.ar.trim() || v } };
    });
  }

  A.views.lists = async function (mount) {
    var both = await Promise.all([A.call('admin.lists.get'), A.call('admin.forms.list')]);
    var lists = both[0].lists;
    var forms = both[1].forms;
    var keys = Object.keys(lists);
    var st = { type: 'all', key: keys[0], rows: null, dirty: false, view: '' };

    /** Plain lists (numbers, codes) read best as chips; named ones need the table. */
    function plain() { return st.rows.every(function (r) { return !r.en && !r.ar; }); }

    var side = h('nav', { class: 'list-nav', 'aria-label': 'Lists' });
    var pane = h('section', { class: 'panel list-pane' });
    var filter = h('div', { class: 'toggle-chips', role: 'radiogroup', 'aria-label': 'Show lists used by' });

    function visibleKeys() {
      if (st.type === 'all') return keys;
      return keys.filter(function (k) {
        var info = LIST_INFO[k];
        return (info && info.types.indexOf(st.type) !== -1) || formsUsing(forms.filter(function (f) { return f.type === st.type; }), k).length;
      });
    }

    function select(key) {
      if (st.dirty && key !== st.key && !window.confirm('Leave ' + listName(st.key) + ' without saving your changes?')) return;
      st.key = key; st.rows = toRows(lists[key]); st.dirty = false; st.view = '';
      paint();
    }

    function paintFilter() {
      ui.clear(filter);
      [['all', 'All lists']].concat(Object.keys(A.TYPES).map(function (k) { return [k, A.TYPES[k].label]; })).forEach(function (o) {
        var on = st.type === o[0];
        filter.appendChild(h('button', { type: 'button', class: 'toggle-chip', name: 'type-' + o[0], role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false', onclick: function () {
          st.type = o[0];
          var vis = visibleKeys();
          if (vis.indexOf(st.key) === -1 && vis.length) select(vis[0]); else paint();
        } }, o[1]));
      });
    }

    function paintSide() {
      ui.clear(side);
      visibleKeys().forEach(function (k) {
        var users = formsUsing(forms, k).length;
        side.appendChild(h('button', { type: 'button', class: 'list-nav-item', name: 'pick-' + k, 'aria-current': k === st.key ? 'true' : null, onclick: function () { select(k); } },
          h('span', { class: 'list-nav-name' }, listName(k), k === st.key && st.dirty ? h('span', { class: 'dirty-dot', title: 'Unsaved changes' }) : null),
          h('span', { class: 'list-nav-meta' }, (lists[k] || []).length + ' choices · ' + (users ? 'used by ' + users + ' form' + (users > 1 ? 's' : '') : 'not used yet'))));
      });
    }

    function touch() { st.dirty = true; paintSide(); saveBar(); }

    var bar = h('div', { class: 'list-save' });
    function saveBar() {
      ui.clear(bar);
      var saveBtn = h('button', { type: 'button', class: 'btn btn-primary sm', name: 'save-list', disabled: !st.dirty }, 'Save ' + listName(st.key));
      saveBtn.addEventListener('click', function () {
        A.busy(saveBtn, async function () {
          var vals = fromRows(st.rows);
          if (!vals.length) return toast('A list needs at least one choice.', 'err');
          var seen = {};
          var dup = vals.filter(function (v) { var d = seen[v.value]; seen[v.value] = true; return d; })[0];
          if (dup) return toast('"' + dup.value + '" is in the list twice.', 'err');
          var out = await A.call('admin.lists.set', { key: st.key, values: vals });
          lists = out.lists;
          st.rows = toRows(lists[st.key]); st.dirty = false;
          toast(listName(st.key) + ' saved. Every form using it shows the new choices.', 'ok');
          paint();
        });
      });
      bar.appendChild(h('span', { class: 'muted-note' }, st.dirty ? 'Unsaved changes' : 'All changes saved'));
      if (st.dirty) bar.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'revert', onclick: function () { st.rows = toRows(lists[st.key]); st.dirty = false; paint(); } }, 'Undo changes'));
      bar.appendChild(saveBtn);
    }

    function rowEl(r, i) {
      var move = function (d) { var j = i + d; if (j < 0 || j >= st.rows.length) return; var t = st.rows[i]; st.rows[i] = st.rows[j]; st.rows[j] = t; touch(); paintRows(); };
      return h('li', { class: 'choice', dataset: { i: String(i) } },
        h('span', { class: 'choice-n' }, String(i + 1)),
        A.text(r.value, function (v) { r.value = v; touch(); }, { class: 'input', name: 'value-' + i, 'aria-label': 'Saved value ' + (i + 1), dir: 'auto' }),
        A.text(r.en, function (v) { r.en = v; touch(); }, { class: 'input', name: 'en-' + i, 'aria-label': 'English name ' + (i + 1), placeholder: 'Same as value', dir: 'ltr' }),
        A.text(r.ar, function (v) { r.ar = v; touch(); }, { class: 'input', name: 'ar-' + i, 'aria-label': 'Arabic name ' + (i + 1), placeholder: 'نفس القيمة', dir: 'rtl', lang: 'ar' }),
        h('span', { class: 'choice-tools' },
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Move up', disabled: i === 0, onclick: function () { move(-1); } }, '↑'),
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Move down', disabled: i === st.rows.length - 1, onclick: function () { move(1); } }, '↓'),
          h('button', { type: 'button', class: 'icon-btn sm danger', name: 'remove-' + i, 'aria-label': 'Remove ' + (r.value || 'choice'), onclick: function () { st.rows.splice(i, 1); touch(); paintRows(); } }, icon('trash', 16))));
    }

    var rowsBox = h('div');
    function chipEl(r, i) {
      return h('li', { class: 'value-chip', dataset: { i: String(i) } }, h('span', { dir: 'auto' }, r.value),
        h('button', { type: 'button', name: 'remove-' + i, 'aria-label': 'Remove ' + r.value, onclick: function () { st.rows.splice(i, 1); touch(); paintRows(); } }, icon('x', 14)));
    }
    function paintRows() {
      ui.clear(rowsBox);
      if (!st.rows.length) return rowsBox.appendChild(h('div', { class: 'empty' }, 'No choices yet. Add the first one below.'));
      if (st.view === 'chips') return rowsBox.appendChild(h('ul', { class: 'value-chips' }, st.rows.map(chipEl)));
      rowsBox.appendChild(h('div', { class: 'choice-head', 'aria-hidden': 'true' }, h('span'), h('span', null, 'Saved value'), h('span', null, 'English name'), h('span', null, 'Arabic name'), h('span')));
      rowsBox.appendChild(h('ol', { class: 'choices' }, st.rows.map(rowEl)));
    }

    function adder() {
      var v = h('input', { class: 'input', name: 'new-value', placeholder: 'New choice', dir: 'auto', 'aria-label': 'New choice' });
      var en = h('input', { class: 'input', name: 'new-en', placeholder: 'English name (optional)', dir: 'ltr', 'aria-label': 'English name for the new choice' });
      var add = function () {
        if (!v.value.trim()) return v.focus();
        st.rows.push({ value: v.value.trim(), en: en.value.trim(), ar: '' });
        var named = !!en.value.trim();
        v.value = ''; en.value = '';
        touch();
        if (named && st.view === 'chips') { st.view = 'table'; paintPane(); pane.querySelector('[name="new-value"]').focus(); return; }
        paintRows(); v.focus();
      };
      [v, en].forEach(function (x) { x.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } }); });
      return h('div', { class: 'choice-add' }, v, en, h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'add-choice', onclick: add }, icon('plus', 18), 'Add'));
    }

    function tools() {
      var numeric = st.rows.length > 0 && st.rows.every(function (r) { return /^\d+$/.test(r.value); });
      var from = h('input', { class: 'input num', type: 'number', name: 'range-from', value: '1', 'aria-label': 'From' });
      var to = h('input', { class: 'input num', type: 'number', name: 'range-to', value: String(Math.max(st.rows.length, 1)), 'aria-label': 'To' });
      var range = numeric || !st.rows.length ? h('div', { class: 'list-tool' },
        h('span', { class: 'label' }, 'Fill with numbers'), h('span', null, 'from'), from, h('span', null, 'to'), to,
        h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'fill-range', onclick: function () {
          var a = parseInt(from.value, 10), b = parseInt(to.value, 10);
          if (!(a >= 0) || !(b >= a) || b - a > 300) return toast('Use a range like 1 to 33.', 'err');
          st.rows = []; for (var n = a; n <= b; n++) st.rows.push({ value: String(n), en: '', ar: '' });
          touch(); paintRows();
        } }, 'Replace the list')) : null;
      var paste = h('textarea', { class: 'textarea', rows: '5', name: 'paste-list', placeholder: 'One choice per line. To give an English name, add a bar:\nحاسبات | Computers', 'aria-label': 'Paste many choices' });
      var details = h('details', { class: 'list-tool paste-tool' }, h('summary', null, 'Paste many at once'),
        paste,
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'paste-add', onclick: function () { st.rows = st.rows.concat(parse(paste.value)); paste.value = ''; touch(); paintRows(); } }, 'Add to the end'),
          h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'paste-replace', onclick: function () { st.rows = parse(paste.value); paste.value = ''; touch(); paintRows(); } }, 'Replace the list')));
      return [range, details];
    }

    function parse(text) {
      return String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
        var i = l.indexOf('|');
        return i === -1 ? { value: l, en: '', ar: '' } : { value: l.slice(0, i).trim(), en: l.slice(i + 1).trim(), ar: '' };
      });
    }

    function paintPane() {
      ui.clear(pane);
      var key = st.key;
      if (!key) return pane.appendChild(h('div', { class: 'empty' }, 'No lists for this kind of form.'));
      var info = LIST_INFO[key] || { about: '', types: [] };
      var users = formsUsing(forms, key);
      pane.dataset.list = key;
      pane.appendChild(h('div', { class: 'list-head' },
        h('h2', null, listName(key)),
        h('p', { class: 'help' }, info.about),
        h('div', { class: 'used-by' }, h('span', { class: 'label' }, 'Used by'),
          users.length ? users.map(function (f) { return h('a', { class: 'used-chip', href: '#/f/' + encodeURIComponent(f.slug) + '/settings' }, icon((A.TYPES[f.type] || {}).icon || 'task', 14), f.title, f.term ? h('span', { class: 'muted-note' }, f.term) : null); })
            : h('span', { class: 'muted-note' }, 'No form uses it yet. New ' + info.types.map(function (t) { return (A.TYPES[t] || { label: t }).label.toLowerCase(); }).join(', ') + ' forms will.'))));
      if (!st.view) st.view = plain() ? 'chips' : 'table';
      pane.appendChild(h('div', { class: 'view-switch', role: 'radiogroup', 'aria-label': 'Layout' },
        h('span', { class: 'muted-note' }, st.rows.length + ' choices'),
        [['chips', 'Compact'], ['table', 'With English and Arabic names']].map(function (v) {
          return h('button', { type: 'button', class: 'toggle-chip sm', name: 'view-' + v[0], role: 'radio', 'aria-checked': st.view === v[0] ? 'true' : 'false', 'aria-pressed': st.view === v[0] ? 'true' : 'false', onclick: function () { st.view = v[0]; paintPane(); } }, v[1]);
        })));
      paintRows();
      pane.appendChild(rowsBox);
      pane.appendChild(adder());
      tools().forEach(function (t) { if (t) pane.appendChild(t); });
      pane.appendChild(h('p', { class: 'muted-note' }, 'Changes reach every form that uses this list as soon as you save. Answers already saved are not changed.'));
      saveBar();
      pane.appendChild(bar);
    }

    function paint() { paintFilter(); paintSide(); paintPane(); }

    st.rows = toRows(lists[st.key]);
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Lists')));
    mount.appendChild(h('p', { class: 'help' }, 'The choices behind dropdown questions. Each list is shared by every form that asks that question. Show only the lists a kind of form uses:'));
    mount.appendChild(filter);
    mount.appendChild(h('div', { class: 'lists-layout' }, side, pane));
    paint();
  };
})(window.App = window.App || {});
