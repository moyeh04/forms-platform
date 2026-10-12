/** Admin: instructor and client links. */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast, A = App.admin;

  var COLUMNS = [
    ['time', 'Time'], ['name', 'Name'], ['code', 'Code'], ['phone', 'Phone'], ['email', 'Email'], ['title', 'Project or task'],
    ['level', 'Level'], ['section', 'Section'], ['group', 'Group'], ['link', 'Link'], ['review', 'Review']
  ];

  /* ── Clients ────────────────────────────────────────────────── */

  /** Shows a new link and its key once, apart, so they can be sent through two channels. */
  function revealAccess(title, token, key) {
    var link = token ? A.viewerLink(token) : '';
    var copy = function (value) { return h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(value)) ? 'Copied' : 'Could not copy', 'ok'); } }, icon('copy', 16), 'Copy'); };
    var body = h('div', { class: 'access-reveal l-stack' },
      h('p', null, 'For safety these are shown only once. You can always make new ones.'),
      link ? h('div', null, h('span', { class: 'label' }, 'Link'), h('div', { class: 'link-box' }, h('code', null, link)), copy(link)) : null,
      key ? h('div', null, h('span', { class: 'label' }, 'Access key'), h('div', { class: 'key-reveal', name: 'access-key' }, key), copy(key),
        h('p', { class: 'help' }, 'Send the key apart from the link, for example the link by email and the key by WhatsApp. The link alone opens nothing.')) : null);
    return A.modal(title, body, [{ text: 'Done', kind: 'primary' }]);
  }

  A.views.clients = async function (mount) {
    var both = await Promise.all([A.call('admin.clients.list'), A.call('admin.forms.list')]);
    var clients = both[0].clients;
    var forms = both[1].forms;
    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Clients and instructors'),
      h('button', { type: 'button', class: 'btn btn-primary', name: 'newClient', onclick: function () { clientDialog(null, forms); } }, icon('plus', 20), 'New private link')));
    mount.appendChild(h('p', { class: 'help' }, 'A private link lets an instructor or client see chosen forms without a Google account or a PIN. It is read-only, and you choose which columns they see. With an access key, the link also asks for six digits that you send separately, so a forwarded link opens nothing. Turn a link off at any time.'));
    if (!clients.length) return mount.appendChild(h('div', { class: 'empty' }, 'No private links yet.'));

    mount.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'data-table cards' },
      h('thead', null, h('tr', null, ['Name', 'Can see', 'Hidden columns', 'Can review', 'Link', 'Access key', ''].map(function (c) { return h('th', null, c); }))),
      h('tbody', null, clients.map(function (c) {
        var access = c.forms.indexOf('*') !== -1 ? 'All forms' : c.forms.map(function (s) { var f = forms.filter(function (x) { return x.slug === s; })[0]; return f ? f.title : s; }).join(', ');
        return h('tr', { dataset: { client: c.id } },
          h('td', { class: 'nm' }, h('strong', null, c.name)), h('td', { dataset: { label: 'Can see' } }, access || 'No forms'),
          h('td', { dataset: { label: 'Hidden columns' } }, c.hiddenColumns.length ? c.hiddenColumns.join(', ') : 'None'), h('td', { dataset: { label: 'Can review' } }, c.canReview ? 'Yes' : 'No'),
          h('td', { dataset: { label: 'Link' } }, A.badge(c.active ? 'On' : 'Off', c.active ? 'open' : 'closed')),
          h('td', { dataset: { label: 'Access key' } }, h('div', { class: 'client-key' }, c.hasKey ? 'Asked' : h('span', { class: 'warn-text' }, 'Not asked'),
            h('button', { type: 'button', class: 'link-btn', name: 'new-key', onclick: function (e) {
              A.busy(e.currentTarget, async function () {
                if (c.hasKey && !(await ui.confirm({ title: 'Make a new key for ' + c.name + '?', body: 'The old key stops working right away. Send them the new one.', confirmText: 'Make new key' }))) return;
                var r = await A.call('admin.clients.key', { id: c.id, on: true });
                revealAccess((c.hasKey ? 'New access key for ' : 'Access key for ') + c.name, '', r.accessKey);
                A.render();
              });
            } }, c.hasKey ? 'New key' : 'Add a key'),
            c.hasKey ? h('button', { type: 'button', class: 'link-btn', name: 'remove-key', onclick: function (e) {
              A.busy(e.currentTarget, async function () {
                if (!(await ui.confirm({ title: 'Remove the key of ' + c.name + '?', body: 'The link alone will open their view again.', confirmText: 'Remove key', danger: true }))) return;
                await A.call('admin.clients.key', { id: c.id, on: false });
                toast('The link no longer asks for a key.', 'ok');
                A.render();
              });
            } }, 'Remove') : null)),
          h('td', null, h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'edit', onclick: function () { clientDialog(c, forms); } }, 'Edit'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'regenerate', onclick: function (e) {
              A.busy(e.currentTarget, async function () {
                var ok = await ui.confirm({ title: 'Make a new link for ' + c.name + '?', body: 'The old link stops working right away.', confirmText: 'Make new link' });
                if (!ok) return;
                var r = await A.call('admin.clients.regenerate', { id: c.id });
                revealAccess('New link for ' + c.name, r.token, '');
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
      forms: client ? client.forms.filter(function (s) { return s !== '*'; }) : [], hidden: client ? client.hiddenColumns.slice() : [], canReview: client ? client.canReview : false,
      withKey: true
    };
    var formBoxes = h('div', null, forms.map(function (f) {
      var caption = FormMetadata.caption(f);
      return A.check(f.title + (caption ? ' (' + caption + ')' : ''), st.forms.indexOf(f.slug) !== -1, function (v) {
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
      A.check('Allow them to mark review steps as approved or rejected', st.canReview, function (v) { st.canReview = v; }),
      // A key is chosen when the link is made; later it is added, changed or removed from the list.
      client ? null : A.check('Also ask for a six-digit access key (recommended)', st.withKey, function (v) { st.withKey = v; }, false, 'withKey'));
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
          var r = await A.call('admin.clients.create', { name: st.name, forms: formsList, hiddenColumns: st.hidden, canReview: st.canReview, withKey: st.withKey });
          revealAccess('Link for ' + r.client.name, r.token, r.accessKey);
        }
        A.render();
      } }
    ]);
  }
})(window.App = window.App || {});
