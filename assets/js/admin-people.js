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

  function linesOf(values) {
    return (values || []).map(function (o) {
      var en = o.label && o.label.en;
      return en && en !== o.value ? o.value + ' | ' + en : o.value;
    }).join('\n');
  }

  function valuesOf(text) {
    return String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var i = l.indexOf('|');
      return i === -1 ? l : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    });
  }

  var LIST_NAMES = {
    levels: 'Levels', curricula: 'Bylaws', majors: 'Majors', sections: 'Sections', groups: 'Groups', wa_sections: 'WhatsApp section numbers'
  };

  A.views.lists = async function (mount) {
    var lists = (await A.call('admin.lists.get')).lists;
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Lists')));
    mount.appendChild(h('p', { class: 'help' }, 'These are the choices behind the dropdowns. Write one choice per line. To show a different English name, write the stored value, a bar, then the English name. For example: الأول / الثانية | Level 1 / Year 2. Changes reach every form straight away.'));
    Object.keys(lists).forEach(function (key) {
      var ta = h('textarea', { class: 'textarea', rows: '7', name: 'list-' + key, 'aria-label': LIST_NAMES[key] || key });
      ta.value = linesOf(lists[key]);
      var btn = h('button', { type: 'button', class: 'btn btn-primary sm', name: 'save-' + key }, 'Save');
      btn.addEventListener('click', function () {
        A.busy(btn, async function () {
          var vals = valuesOf(ta.value);
          if (!vals.length) return toast('A list needs at least one choice.', 'err');
          await A.call('admin.lists.set', { key: key, values: vals });
          toast((LIST_NAMES[key] || key) + ' saved', 'ok');
        });
      });
      mount.appendChild(h('section', { class: 'panel', dataset: { list: key } }, h('h2', null, LIST_NAMES[key] || key), ta, h('div', { class: 'actions', style: { marginTop: '8px' } }, btn)));
    });
  };
})(window.App = window.App || {});
