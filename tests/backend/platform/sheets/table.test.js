const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../harness/appsscript-mock.js');

function boot(type = 'team_registration', patch = {}) {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  const form = w.admin({
    action: 'admin.forms.create',
    type,
    title: 'Database Team Project',
    term: 'Fall 2027'
  }).form;
  w.admin({
    action: 'admin.forms.update',
    id: form.id,
    patch: { status: 'open', ...patch }
  });
  w.form = form;
  w.submit = (data, extra = {}) =>
    w.api({ action: 'submit', slug: form.slug, data, ...extra });
  w.rows = () => w.sheet(form.sheetId, 'Responses').rows();
  return w;
}

const sized = (d) => ({
  team_size: String((d.members || []).length + 1),
  ...d
});
const team = (o = {}) =>
  sized({
    email: 'Sara@Example.com',
    leader_name: 'أحمد محمد محمود أحمد',
    leader_code: '4230999',
    phone: '+201012345678',
    major: 'حاسبات',
    level: 'صفر / الأولى',
    section: '4C-TH1',
    curriculum: '2020',
    members: [
      {
        name: 'سارة خالد حسن علي',
        phone: '01112345678',
        code: '4230998',
        level: 'صفر / الأولى',
        curriculum: '2020',
        section: '4C-TH1'
      }
    ],
    title: 'Library System',
    ...o
  });

test('Rows: a new row is written as plain text, also past the rows the sheet was made with', () => {
  const w = boot();
  w.submit(team());
  const sheet = w.sheet(w.form.sheetId, 'Responses');
  assert.equal(sheet.formats.get('2,10'), '@', 'the phone cell of the new row');
  // The sheet has 1000 formatted rows; the next row is beyond them.
  sheet.set(1000, 1, 'filler');
  w.submit(
    team({
      leader_code: '4230777',
      members: [
        {
          name: 'سارة خالد حسن علي',
          phone: '01112345678',
          code: '4230778',
          level: 'صفر / الأولى',
          curriculum: '2020',
          section: '4C-TH1'
        }
      ]
    })
  );
  assert.equal(sheet.get(1001, 10), '01012345678');
  assert.equal(sheet.formats.get('1001,10'), '@');
});
