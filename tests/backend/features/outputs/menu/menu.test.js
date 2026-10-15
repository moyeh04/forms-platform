const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const person = (o) =>
  sized({
    email: 'a@b.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: '4230001',
    phone: '01012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    ...o
  });

function boot(type, patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Seminar Booking',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  w.view = (name) => w.sheet(form.sheetId, name);
  return w;
}

const slots = {
  days: [
    {
      label: 'Week 11 - Sunday',
      date: '2027-11-14',
      times: ['12:30 - 12:50', '12:55 - 1:15', '1:20 - 1:40']
    }
  ],
  capacity: 1
};

test(
  'Menu: print dialogs list the right ' + 'forms and days and escape titles',
  () => {
    const w = boot('reservation', { slots });
    w.admin({
      action: 'admin.forms.create',
      type: 'team_registration',
      title: 'A <b>team</b> form',
      term: ''
    });
    const opts = w.call('menuPrintOptions', 'reservations');
    assert.equal(opts.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(opts[0].days)), [
      { id: 'week-11-sunday', label: 'Week 11 - Sunday' }
    ]);
    const teams = w.call('menuPrintOptions', 'teams');
    assert.equal(teams.length, 1);
    const html = w.call('PrintDialog.printDialogHtml', 'teams');
    assert.ok(html.includes('A &lt;b&gt;team&lt;/b&gt; form'));
    assert.equal(html.includes('<b>team</b>'), false);
  }
);

test('Menu: menuPrint creates the tab from the dialog call', () => {
  const w = boot('reservation', { slots });
  w.api({
    action: 'submit',
    slug: w.form.slug,
    data: person({
      title: 'First',
      slot: { day: 'week-11-sunday', time: '12:30 - 12:50' }
    })
  });
  const r = w.call(
    'menuPrint',
    'reservations',
    w.form.slug,
    'week-11-sunday',
    false
  );
  assert.equal(r.count, 1);
});
